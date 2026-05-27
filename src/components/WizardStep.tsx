import { ReactNode } from "react";

type WizardStepProps = {
  number: string;
  title: string;
  children: ReactNode;
};

export function WizardStep({ number, title, children }: WizardStepProps) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-2.5">
        <span className="grid size-6 shrink-0 place-items-center rounded-full border border-white/[0.06] bg-white/[0.03] text-[9px] font-bold text-zinc-500">
          {number}
        </span>
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{title}</h2>
      </div>
      {children}
    </section>
  );
}
