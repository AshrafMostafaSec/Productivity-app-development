export default function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="ios-row px-6 py-7 text-center">
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="mt-1 text-[13px] leading-snug text-secondary">{detail}</p>
    </div>
  );
}
