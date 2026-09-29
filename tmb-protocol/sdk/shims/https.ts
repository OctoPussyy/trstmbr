// Browser stand-in for Node's `https`/`http`. @switchboard-xyz/common runs
//   import { Agent } from 'https'; new Agent({ maxSockets: 100 })
// at load time; browsers have no such module, hence "Agent is not a constructor".
// Alias `https` and `http` to this file in your bundler config (see README "Browser setup").
export class Agent {
  constructor(_options?: unknown) {}
}
export default { Agent };
