/* Questions answered on the home page and the method page (and as FAQ structured data). Every answer is true of the site as built. */
export type Faq = { q: string; a: string };

export const FAQ: Faq[] = [
  {
    q: "Does Deleq hold my funds?",
    a: "No. Your tokens stay in your wallet. You approve the guard contract for an ERC-20 amount you choose, and each action moves tokens straight from your wallet to an allowlisted recipient (or, for a swap, through the router and back to you) inside one transaction. The guard never keeps a balance between transactions, and it has no admin who could move anything.",
  },
  {
    q: "What exactly can the agent do?",
    a: "Only two things, and only within the mandate: pay a listed token to a listed recipient, or swap a listed token for another listed token through a listed router with the output sent to you. Each token has its own per-transaction cap and daily cap (UTC day), and you can also cap the number of actions per day. The agent cannot change any limit; it can only pause itself.",
  },
  {
    q: "How fast does pause or revoke work?",
    a: "From the very next transaction. The guard reads the mandate's state on every call, so an action in a later block (or later in the same block) is refused. Pause can be undone by the owner; revoke cannot.",
  },
  {
    q: "What does the token check tell me?",
    a: "What Robinhood Chain says about the token at one block: whether it has code and answers as an ERC-20, whether it is an upgradeable proxy, who owner() is, which mint, pause, blocklist, burn, fee or upgrade functions appear in its code, whether it launched through Pons, and which Uniswap v3 pools trade it against WETH or USDG. Every row shows its source and the block. A clean check does not mean a token is safe, and anything we could not read says Not known.",
  },
  {
    q: "Why does a rejection not show up on the explorer?",
    a: "A transaction that reverts leaves no event. That is why Deleq runs the guard's own check view before anything is signed, shows the reason bits, and keeps rejected proposals in your browser's log. Executed actions are events on chain and show up in the dashboard with their transaction links.",
  },
  {
    q: "Can I use it with native ETH or any token?",
    a: "Not native ETH in this version: wrap it to WETH first. Fee-on-transfer tokens are refused (the guard checks that the recipient got exactly the amount sent). Tokens that return nothing on transfer, like some older stablecoins, are handled. Robinhood stock tokens can block addresses; if they do, the transfer reverts.",
  },
  {
    q: "Do I need the $DELEQ token?",
    a: "No. Mandates, checks, the guard and the dashboard work without it and the token is not live yet. Its planned use is advanced risk checks and alerts; that part is a concept and is labelled as one.",
  },
  {
    q: "Is Deleq connected to Robinhood?",
    a: "No. Deleq is an independent prototype that uses public contracts on Robinhood Chain. Nothing here is investment advice, and a limit is not a promise that an agent's trades will be good ones.",
  },
];
