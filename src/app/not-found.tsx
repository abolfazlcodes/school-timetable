import Link from "next/link";

export default function NotFound() {
  return <main className="standalone-state"><div className="state"><span className="not-found-code">۴۰۴</span><h1>این صفحه پیدا نشد</h1><p>ممکن است نشانی صفحه تغییر کرده یا دسترسی آن برداشته شده باشد.</p><Link className="button button--primary button--md" href="/">بازگشت به نمای کلی</Link></div></main>;
}
