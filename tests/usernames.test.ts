import {describe,it,expect} from 'vitest';
import {usernameToEmail} from '../src/usernames';
describe('two-person username login',()=>{it('maps only the two configured aliases',()=>{expect(usernameToEmail('tape')).toBe('tape@moneyspace.invalid');expect(usernameToEmail('pat')).toBe('pat@moneyspace.invalid');expect(usernameToEmail(' TAPE ')).toBe('tape@moneyspace.invalid')});it('never treats email, prototype keys, or unlisted names as accounts',()=>{for(const value of ['','other','tape@example.com','constructor','toString','__proto__'])expect(usernameToEmail(value)).toBeNull()})});
