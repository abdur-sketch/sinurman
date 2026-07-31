import { database, ensureUser, seedIfNeeded } from "../_lib";
import { notifyGuardian } from "../_notifications";

type CartItem = { productId?: number; quantity?: number };
type AccountRow = {
  id:number;
  student_id:number;
  student_name:string;
  nis:string;
  class_name:string;
  room:string;
  card_token:string;
  balance:number;
  daily_limit:number;
  status:string;
  guardian_email:string;
};

const rupiah = new Intl.NumberFormat("id-ID");

function csvValue(value:unknown) {
  return `"${String(value ?? "").replaceAll('"','""')}"`;
}

function parseScan(value:unknown) {
  const scan=String(value??"").trim();
  if(!scan) return {token:"",id:0,nis:""};
  try {
    const payload=JSON.parse(scan) as {walletToken?:string;id?:number;nis?:string};
    return {token:String(payload.walletToken??""),id:Number(payload.id??0),nis:String(payload.nis??"")};
  } catch {
    return scan.startsWith("SNP-")?{token:scan,id:0,nis:""}:{token:"",id:0,nis:scan};
  }
}

async function findAccount(scan:unknown) {
  const parsed=parseScan(scan);
  return database().prepare(
    `SELECT w.*,s.name AS student_name,s.nis,s.class_name,s.room,s.guardian_email
     FROM wallet_accounts w JOIN students s ON s.id=w.student_id
     WHERE (?<>'' AND w.card_token=?) OR (?<>0 AND s.id=?) OR (?<>'' AND s.nis=?) LIMIT 1`,
  ).bind(parsed.token,parsed.token,parsed.id,parsed.id,parsed.nis,parsed.nis).first<AccountRow>();
}

async function getPayload(user:{email:string;role:string;guardianPhone?:string}) {
  const db=database();
  const guardian=user.role==="Wali Santri";
  const guardianField=user.guardianPhone?"s.guardian_phone=?":"lower(s.guardian_email)=lower(?)";
  const guardianKey=user.guardianPhone||user.email;
  const accountQuery=guardian
    ? db.prepare(`SELECT w.id,w.student_id,s.name AS student_name,s.nis,s.class_name,s.room,w.balance,w.daily_limit,w.status,w.updated_at
                  FROM wallet_accounts w JOIN students s ON s.id=w.student_id WHERE ${guardianField} ORDER BY s.name`).bind(guardianKey)
    : db.prepare(`SELECT w.*,s.name AS student_name,s.nis,s.class_name,s.room
                  FROM wallet_accounts w JOIN students s ON s.id=w.student_id ORDER BY s.name`);
  const entryQuery=guardian
    ? db.prepare(`SELECT e.*,s.name AS student_name FROM wallet_entries e JOIN students s ON s.id=e.student_id
                  WHERE ${guardianField} ORDER BY e.id DESC LIMIT 150`).bind(guardianKey)
    : db.prepare(`SELECT e.*,s.name AS student_name FROM wallet_entries e JOIN students s ON s.id=e.student_id ORDER BY e.id DESC LIMIT 250`);
  const saleQuery=guardian
    ? db.prepare(`SELECT c.*,s.name AS student_name,s.nis FROM canteen_sales c JOIN students s ON s.id=c.student_id
                  WHERE ${guardianField} ORDER BY c.id DESC LIMIT 100`).bind(guardianKey)
    : db.prepare(`SELECT c.*,s.name AS student_name,s.nis FROM canteen_sales c JOIN students s ON s.id=c.student_id ORDER BY c.id DESC LIMIT 150`);
  const topupQuery=guardian
    ? db.prepare(`SELECT t.*,s.name AS student_name,s.nis FROM wallet_topups t JOIN students s ON s.id=t.student_id
                  WHERE ${guardianField} ORDER BY t.id DESC LIMIT 100`).bind(guardianKey)
    : db.prepare(`SELECT t.*,s.name AS student_name,s.nis FROM wallet_topups t JOIN students s ON s.id=t.student_id ORDER BY t.id DESC LIMIT 200`);
  const [accounts,entries,topups,sales,products,items,ledgerTotal]=await Promise.all([
    accountQuery.all(),entryQuery.all(),topupQuery.all(),
    saleQuery.all(),
    db.prepare("SELECT * FROM canteen_products ORDER BY status DESC,category,name").all(),
    guardian
      ? db.prepare(`SELECT i.* FROM canteen_sale_items i JOIN canteen_sales c ON c.id=i.sale_id JOIN students s ON s.id=c.student_id
                    WHERE ${guardianField} ORDER BY i.id DESC LIMIT 400`).bind(guardianKey).all()
      : db.prepare("SELECT * FROM canteen_sale_items ORDER BY id DESC LIMIT 600").all(),
    guardian
      ? db.prepare(`SELECT COALESCE(SUM(e.amount),0) AS total FROM wallet_entries e JOIN students s ON s.id=e.student_id
                    WHERE ${guardianField}`).bind(guardianKey).first<{total:number}>()
      : db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM wallet_entries").first<{total:number}>(),
  ]);
  const today=new Date().toISOString().slice(0,10);
  const todaySales=(sales.results as Record<string,unknown>[]).filter(row=>String(row.created_at).slice(0,10)===today&&row.status==="Berhasil");
  const totalBalance=(accounts.results as Record<string,unknown>[]).reduce((sum,row)=>sum+Number(row.balance||0),0);
  const ledgerBalance=Number(ledgerTotal?.total||0);
  return {
    accounts:accounts.results,
    entries:entries.results,
    topups:topups.results,
    products:products.results,
    sales:sales.results,
    saleItems:items.results,
    stats:{
      totalBalance,
      todayRevenue:todaySales.reduce((sum,row)=>sum+Number(row.total||0),0),
      todayTransactions:todaySales.length,
      lowStock:(products.results as Record<string,unknown>[]).filter(row=>Number(row.stock)<=10&&row.status==="Aktif").length,
      ledgerBalance,
      reconciliationVariance:totalBalance-ledgerBalance,
      stockValue:(products.results as Record<string,unknown>[]).reduce((sum,row)=>sum+Number(row.price||0)*Number(row.stock||0),0),
      reversedTransactions:(sales.results as Record<string,unknown>[]).filter(row=>row.status==="Dibatalkan").length,
    },
  };
}

export async function GET(request:Request) {
  try {
    const user=await ensureUser(request);
    await seedIfNeeded();
    const url=new URL(request.url);
    if(url.searchParams.get("format")==="csv") {
      if(user.role!=="Admin") return Response.json({error:"Ekspor SINURPAY hanya tersedia untuk Admin."},{status:403});
      const result=await database().prepare(
        `SELECT c.receipt_no,c.created_at,s.nis,s.name AS student,c.total,c.status,c.cashier_email
         FROM canteen_sales c JOIN students s ON s.id=c.student_id ORDER BY c.id DESC`,
      ).all<Record<string,unknown>>();
      const columns=["receipt_no","created_at","nis","student","total","status","cashier_email"];
      const csv=[columns.map(csvValue).join(","),...result.results.map(row=>columns.map(key=>csvValue(row[key])).join(","))].join("\n");
      return new Response(`\uFEFF${csv}`,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":'attachment; filename="sinurpay-transaksi.csv"'}});
    }
    return Response.json(await getPayload(user));
  } catch(error) {
    return Response.json({error:error instanceof Error?error.message:"Data SINURPAY gagal dimuat."},{status:500});
  }
}

export async function POST(request:Request) {
  try {
    const user=await ensureUser(request);
    if(user.role!=="Admin") return Response.json({error:"Transaksi SINURPAY hanya dapat diproses petugas berwenang."},{status:403});
    const body=await request.json() as {
      action?:string;
      scan?:string;
      studentId?:number;
      amount?:number;
      direction?:"deposit"|"withdraw";
      note?:string;
      dailyLimit?:number;
      status?:string;
      product?:Record<string,unknown>;
      cart?:CartItem[];
      saleId?:number;
    };
    const db=database();
    const now=new Date().toISOString();

    if(body.action==="wallet-adjust") {
      const studentId=Number(body.studentId);
      const amount=Math.round(Number(body.amount));
      if(!studentId||!Number.isFinite(amount)||amount<1000) return Response.json({error:"Nominal minimal Rp1.000."},{status:400});
      const account=await db.prepare("SELECT balance,status FROM wallet_accounts WHERE student_id=?").bind(studentId).first<{balance:number;status:string}>();
      if(!account) return Response.json({error:"Rekening tabungan santri tidak ditemukan."},{status:404});
      const outgoing=body.direction==="withdraw";
      const balanceAfter=Number(account.balance)+(outgoing?-amount:amount);
      if(balanceAfter<0) return Response.json({error:"Saldo tidak mencukupi untuk penarikan."},{status:400});
      const reference=`SNP-${now.replace(/\D/g,"").slice(0,14)}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
      await db.batch([
        db.prepare("UPDATE wallet_accounts SET balance=?,updated_at=? WHERE student_id=?").bind(balanceAfter,now,studentId),
        db.prepare("INSERT INTO wallet_entries (student_id,entry_type,amount,balance_after,reference,note,actor_email,created_at) VALUES (?,?,?,?,?,?,?,?)")
          .bind(studentId,outgoing?"Penarikan":"Setoran",outgoing?-amount:amount,balanceAfter,reference,String(body.note||""),user.email,now),
        db.prepare("INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,?,?,?)")
          .bind(user.email,outgoing?"Penarikan":"Setoran","sinurpay",studentId,`${outgoing?"Penarikan":"Setoran"} Rp${rupiah.format(amount)}`,now),
      ]);
      try { await notifyGuardian(studentId,`SINURPAY: ${outgoing?"Penarikan":"Setoran"} Rp${rupiah.format(amount)} berhasil. Saldo saat ini Rp${rupiah.format(balanceAfter)}.`); } catch { /* notification must not block wallet */ }
      return Response.json({ok:true,balance:balanceAfter,reference});
    }

    if(body.action==="update-account") {
      const studentId=Number(body.studentId);
      const limit=Math.round(Number(body.dailyLimit));
      const status=String(body.status||"Aktif");
      if(!studentId||!Number.isFinite(limit)||limit<0||limit>1000000) return Response.json({error:"Limit harian harus antara Rp0 sampai Rp1.000.000."},{status:400});
      if(!["Aktif","Diblokir"].includes(status)) return Response.json({error:"Status kartu tidak valid."},{status:400});
      await db.batch([
        db.prepare("UPDATE wallet_accounts SET daily_limit=?,status=?,updated_at=? WHERE student_id=?").bind(limit,status,now,studentId),
        db.prepare("INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,?,?,?)")
          .bind(user.email,"Ubah","sinurpay",studentId,`Limit Rp${rupiah.format(limit)}, kartu ${status}`,now),
      ]);
      return Response.json({ok:true});
    }

    if(body.action==="product-save") {
      const product=body.product??{};
      const id=Number(product.id||0);
      const sku=String(product.sku||"").trim().toUpperCase();
      const name=String(product.name||"").trim();
      const category=String(product.category||"").trim();
      const price=Math.round(Number(product.price));
      const stock=Math.round(Number(product.stock));
      const status=String(product.status||"Aktif");
      if(!sku||!name||!category||price<1||stock<0) return Response.json({error:"SKU, nama, kategori, harga, dan stok wajib valid."},{status:400});
      if(id) await db.prepare("UPDATE canteen_products SET sku=?,name=?,category=?,price=?,stock=?,status=?,updated_at=? WHERE id=?").bind(sku,name,category,price,stock,status,now,id).run();
      else await db.prepare("INSERT INTO canteen_products (sku,name,category,price,stock,status,updated_at) VALUES (?,?,?,?,?,?,?)").bind(sku,name,category,price,stock,status,now).run();
      await db.prepare("INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,?,?,?)")
        .bind(user.email,id?"Ubah":"Tambah","canteen_products",id||null,`${name} · stok ${stock}`,now).run();
      return Response.json({ok:true});
    }

    if(body.action==="checkout") {
      const account=await findAccount(body.scan);
      if(!account) return Response.json({error:"Kartu atau NIS santri tidak ditemukan."},{status:404});
      if(account.status!=="Aktif") return Response.json({error:"Kartu santri sedang diblokir."},{status:403});
      const requested=(body.cart??[]).filter(item=>Number(item.productId)>0&&Number(item.quantity)>0).slice(0,20);
      if(!requested.length) return Response.json({error:"Keranjang belanja masih kosong."},{status:400});
      if(requested.some(item=>Number(item.quantity)>20)) return Response.json({error:"Maksimal 20 unit untuk satu produk."},{status:400});
      const ids=[...new Set(requested.map(item=>Number(item.productId)))];
      const placeholders=ids.map(()=>"?").join(",");
      const productResult=await db.prepare(`SELECT * FROM canteen_products WHERE id IN (${placeholders})`).bind(...ids).all<Record<string,unknown>>();
      const products=new Map(productResult.results.map(item=>[Number(item.id),item]));
      const lines=requested.map(item=>({product:products.get(Number(item.productId)),quantity:Number(item.quantity)}));
      if(lines.some(line=>!line.product||line.product.status!=="Aktif")) return Response.json({error:"Ada produk yang tidak aktif atau tidak ditemukan."},{status:400});
      if(lines.some(line=>Number(line.product!.stock)<line.quantity)) return Response.json({error:"Stok salah satu produk tidak mencukupi."},{status:400});
      const total=lines.reduce((sum,line)=>sum+Number(line.product!.price)*line.quantity,0);
      if(total>Number(account.balance)) return Response.json({error:`Saldo tidak cukup. Saldo tersedia Rp${rupiah.format(account.balance)}.`},{status:400});
      const today=now.slice(0,10);
      const spent=await db.prepare("SELECT COALESCE(SUM(total),0) AS total FROM canteen_sales WHERE student_id=? AND status='Berhasil' AND substr(created_at,1,10)=?")
        .bind(account.student_id,today).first<{total:number}>();
      if(Number(spent?.total||0)+total>Number(account.daily_limit)) {
        const remaining=Math.max(0,Number(account.daily_limit)-Number(spent?.total||0));
        return Response.json({error:`Melebihi limit harian. Sisa limit hari ini Rp${rupiah.format(remaining)}.`},{status:400});
      }
      const receiptNo=`KTN-${now.replace(/\D/g,"").slice(2,14)}-${crypto.randomUUID().slice(0,4).toUpperCase()}`;
      const sale=await db.prepare("INSERT INTO canteen_sales (receipt_no,student_id,total,status,cashier_email,created_at,reversed_at) VALUES (?,?,?,'Diproses',?,?,'')")
        .bind(receiptNo,account.student_id,total,user.email,now).run();
      const saleId=Number(sale.meta.last_row_id);
      const balanceAfter=Number(account.balance)-total;
      const statements=[
        db.prepare("UPDATE wallet_accounts SET balance=?,updated_at=? WHERE student_id=?").bind(balanceAfter,now,account.student_id),
        ...lines.flatMap(line=>[
          db.prepare("UPDATE canteen_products SET stock=stock-?,updated_at=? WHERE id=?").bind(line.quantity,now,Number(line.product!.id)),
          db.prepare("INSERT INTO canteen_sale_items (sale_id,product_id,product_name,quantity,unit_price,subtotal) VALUES (?,?,?,?,?,?)")
            .bind(saleId,Number(line.product!.id),String(line.product!.name),line.quantity,Number(line.product!.price),Number(line.product!.price)*line.quantity),
        ]),
        db.prepare("INSERT INTO wallet_entries (student_id,entry_type,amount,balance_after,reference,note,actor_email,created_at) VALUES (?,?,?,?,?,?,?,?)")
          .bind(account.student_id,"Pembelian",-total,balanceAfter,receiptNo,lines.map(line=>`${line.product!.name} x${line.quantity}`).join(", "),user.email,now),
        db.prepare("UPDATE canteen_sales SET status='Berhasil' WHERE id=?").bind(saleId),
        db.prepare("INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,?,?,?)")
          .bind(user.email,"Pembelian","sinurpay",saleId,`${account.student_name} · ${receiptNo} · Rp${rupiah.format(total)}`,now),
      ];
      try {
        await db.batch(statements);
      } catch(error) {
        await db.prepare("DELETE FROM canteen_sales WHERE id=? AND status='Diproses'").bind(saleId).run();
        throw error;
      }
      try { await notifyGuardian(account.student_id,`SINURPAY: ${account.student_name} berbelanja Rp${rupiah.format(total)} di kantin. Saldo tersisa Rp${rupiah.format(balanceAfter)}. Ref ${receiptNo}.`); } catch { /* notification must not block checkout */ }
      return Response.json({ok:true,receipt:{id:saleId,receiptNo,total,balanceAfter,studentName:account.student_name}});
    }

    if(body.action==="reverse-sale") {
      const saleId=Number(body.saleId);
      const sale=await db.prepare("SELECT * FROM canteen_sales WHERE id=?").bind(saleId).first<Record<string,unknown>>();
      if(!sale) return Response.json({error:"Transaksi tidak ditemukan."},{status:404});
      if(sale.status!=="Berhasil") return Response.json({error:"Transaksi ini sudah dibatalkan atau belum selesai."},{status:400});
      const account=await db.prepare("SELECT balance FROM wallet_accounts WHERE student_id=?").bind(sale.student_id).first<{balance:number}>();
      const items=await db.prepare("SELECT * FROM canteen_sale_items WHERE sale_id=?").bind(saleId).all<Record<string,unknown>>();
      const balanceAfter=Number(account?.balance||0)+Number(sale.total);
      await db.batch([
        db.prepare("UPDATE wallet_accounts SET balance=?,updated_at=? WHERE student_id=?").bind(balanceAfter,now,sale.student_id),
        ...items.results.map(item=>db.prepare("UPDATE canteen_products SET stock=stock+?,updated_at=? WHERE id=?").bind(item.quantity,now,item.product_id)),
        db.prepare("UPDATE canteen_sales SET status='Dibatalkan',reversed_at=? WHERE id=?").bind(now,saleId),
        db.prepare("INSERT INTO wallet_entries (student_id,entry_type,amount,balance_after,reference,note,actor_email,created_at) VALUES (?,?,?,?,?,?,?,?)")
          .bind(sale.student_id,"Pengembalian",sale.total,balanceAfter,sale.receipt_no,"Pembatalan transaksi kantin",user.email,now),
        db.prepare("INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,?,?,?)")
          .bind(user.email,"Batalkan","sinurpay",saleId,`Pembatalan ${sale.receipt_no} · Rp${rupiah.format(Number(sale.total))}`,now),
      ]);
      try { await notifyGuardian(Number(sale.student_id),`SINURPAY: Transaksi ${sale.receipt_no} dibatalkan. Dana Rp${rupiah.format(Number(sale.total))} dikembalikan. Saldo Rp${rupiah.format(balanceAfter)}.`); } catch { /* notification must not block reversal */ }
      return Response.json({ok:true,balance:balanceAfter});
    }

    return Response.json({error:"Tindakan SINURPAY tidak valid."},{status:400});
  } catch(error) {
    const message=error instanceof Error?error.message:"Transaksi SINURPAY gagal.";
    return Response.json({error:message.includes("UNIQUE")?"SKU atau referensi tersebut sudah digunakan.":message},{status:500});
  }
}
