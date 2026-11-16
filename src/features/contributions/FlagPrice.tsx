export function FlagPrice({ reportId, storeName }: { reportId: string; storeName: string }) {
  return <span hidden>{`${reportId} ${storeName}`}</span>;
}
