const nb = (d: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const bad = (x: number | null | undefined) => x === null || x === undefined || !isFinite(x);
export const num = (x: number | null | undefined, d = 0) => (bad(x) ? "—" : nb(d).format(x as number));
export const pct = (x: number | null | undefined, d = 1) => (bad(x) ? "—" : `${nb(d).format((x as number) * 100)} %`);
export const usd = (x: number | null | undefined, d = 0) => (bad(x) ? "—" : `${nb(d).format(x as number)} $`);
export const musd = (x: number | null | undefined, d = 1) => (bad(x) ? "—" : `${nb(d).format((x as number) / 1e6)} M$`);
export const dec = (x: number | null | undefined, d = 3) => (bad(x) ? "—" : nb(d).format(x as number));
