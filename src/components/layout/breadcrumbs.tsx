import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return <nav className="breadcrumbs" aria-label="مسیر صفحه">{items.map((item, index) => <span key={`${item.label}-${index}`}>{index > 0 ? <ChevronLeft size={14} aria-hidden="true" /> : null}{item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</span>)}</nav>;
}
