import { ArrowLeft, Construction } from "lucide-react";
import Link from "next/link";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return <section className="coming-soon-card"><span><Construction size={22} /></span><p className="eyebrow">MODULE IN PROGRESS</p><h1>{title}</h1><p>{description}</p><Link href="/" className="back-link"><ArrowLeft size={14} /> Вернуться к доске</Link></section>;
}
