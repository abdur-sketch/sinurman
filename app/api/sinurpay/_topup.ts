import { database } from "../_lib";
import { notifyGuardian } from "../_notifications";

export async function settleWalletTopup(topupNo:string,method:string,reference:string) {
  const db=database();
  const topup=await db.prepare("SELECT * FROM wallet_topups WHERE topup_no=?").bind(topupNo).first<Record<string,unknown>>();
  if(!topup) return false;
  if(topup.status==="Berhasil") return true;
  if(!["Menunggu Pembayaran","Menunggu Verifikasi"].includes(String(topup.status))) return false;
  const account=await db.prepare("SELECT balance FROM wallet_accounts WHERE student_id=?").bind(topup.student_id).first<{balance:number}>();
  if(!account) return false;
  const now=new Date().toISOString();
  const balanceAfter=Number(account.balance)+Number(topup.amount);
  await db.batch([
    db.prepare("INSERT INTO wallet_topup_settlements (topup_id,reference,created_at) VALUES (?,?,?)").bind(topup.id,reference,now),
    db.prepare("UPDATE wallet_topups SET status='Berhasil',provider=?,payment_reference=?,paid_at=? WHERE id=? AND status<>'Berhasil'")
      .bind(method,reference,now,topup.id),
    db.prepare("UPDATE wallet_accounts SET balance=?,updated_at=? WHERE student_id=?").bind(balanceAfter,now,topup.student_id),
    db.prepare("INSERT INTO wallet_entries (student_id,entry_type,amount,balance_after,reference,note,actor_email,created_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind(topup.student_id,"Top-up",topup.amount,balanceAfter,topup.topup_no,`Top-up otomatis melalui ${method}`,"payment-webhook@sinurman.id",now),
    db.prepare("INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,?,?,?)")
      .bind("payment-webhook@sinurman.id","Verifikasi","wallet_topups",topup.id,`${topup.topup_no} berhasil melalui ${method}`,now),
  ]);
  try { await notifyGuardian(Number(topup.student_id),`SINURPAY: Top-up ${topup.topup_no} sebesar Rp${Number(topup.amount).toLocaleString("id-ID")} berhasil. Saldo sekarang Rp${balanceAfter.toLocaleString("id-ID")}.`); } catch { /* settlement must remain successful */ }
  return true;
}
