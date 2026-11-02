export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/assets/icons/profile-avatar.png"
        alt=""
        width={compact ? 42 : 68}
        height={compact ? 42 : 68}
        className={compact ? "size-[42px]" : "size-[68px]"}
      />
      <div className="leading-none">
        <div className="text-[13px] font-extrabold tracking-[0.13em] text-[var(--bf-cream)]">
          BEERFACTORY
        </div>
        <div className="mt-1 text-[10px] font-semibold tracking-[0.18em] text-[var(--bf-dim)]">
          STAFF PORTAL
        </div>
      </div>
    </div>
  );
}
