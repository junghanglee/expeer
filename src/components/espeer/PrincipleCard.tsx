export function PrincipleCard({
  num,
  tag,
  title,
  desc,
}: {
  num: string;
  tag: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-3xl bg-white/[0.04] p-5 ring-1 ring-white/10 backdrop-blur lg:p-6">
      <div className="flex items-baseline justify-between">
        <div className="num-display text-[28px] text-primary lg:text-[34px]">{num}</div>
        <div className="text-[10px] font-bold tracking-wider text-background/60">{tag}</div>
      </div>
      <div className="mt-2 text-[16px] font-extrabold leading-snug text-background lg:text-[18px]">
        {title}
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-background/70 lg:text-[13px]">{desc}</p>
    </div>
  );
}
