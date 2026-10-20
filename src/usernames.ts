// Public aliases only. Supabase Auth verifies passwords; this is not authorization.
const aliases: Record<string,string>={tape:'tape@moneyspace.invalid',pat:'pat@moneyspace.invalid'};
export function usernameToEmail(username:string):string|null{const normalized=username.trim().toLowerCase();return Object.hasOwn(aliases,normalized)?aliases[normalized]:null;}
