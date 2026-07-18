// Fixtures. The default is an agentic transcript — mostly code, commands and a
// stack trace, with prose only between the tool calls — because that is what the
// 65% claim collides with. The chat-prose fixture is the other end: nearly all
// compressible, which is where advertised numbers come from.

export interface Sample {
  id: string;
  label: string;
  note: string;
  text: string;
}

const AGENT_TASK = `I would like you to please fix the failing test in the auth module. Basically the CI run is red and I think it started after we bumped the token library. Could you take a look and make sure that the fix does not break the refresh flow?

Here is the failing output from the test run:

$ npm test -- auth

FAIL src/auth/__tests__/session.test.ts
  ● session refresh › issues a new token before expiry

    TypeError: Cannot read properties of undefined (reading 'expiresAt')

    at refreshSession (src/auth/session.ts:42:19)
    at Object.<anonymous> (src/auth/__tests__/session.test.ts:88:5)

The relevant implementation is this:

\`\`\`ts
export async function refreshSession(session: Session): Promise<Session> {
  const claims = decodeToken(session.token);
  if (claims.expiresAt - Date.now() < REFRESH_WINDOW_MS) {
    const next = await issueToken(session.userId);
    return { ...session, token: next.token, expiresAt: next.expiresAt };
  }
  return session;
}
\`\`\`

It is important to note that decodeToken used to return a claims object directly, but in the new version of the library it actually returns a Result wrapper, so you probably need to unwrap it first. Please make sure to keep the existing behaviour when the token is still fresh, and just add a test for the unwrap path as well.

You can find the library changelog here:

https://github.com/example/token-lib/blob/main/CHANGELOG.md

The config that selects the library version lives at:

packages/auth/package.json

Once you are done, please run the full suite and show me the diff.`;

const CHAT_PROSE = `I would like you to please write a short summary of our quarterly engineering review for the leadership team. It is important to note that the audience is basically non-technical, so I think you should really avoid jargon wherever possible.

The main points that I would like you to cover are as follows. First, we actually shipped the new authentication system ahead of schedule, which was quite a significant achievement for the team given that we were down two engineers for most of the quarter. Second, our incident count went down by roughly forty percent compared to the previous quarter, and I believe this is largely because of the investment we made in observability tooling earlier in the year.

Third, and this is the part that I want you to be careful with, we did miss the deadline for the reporting module. Please make sure to frame this honestly but constructively — the reason was essentially that the requirements changed twice during the quarter, and I would like the summary to make it clear that the team responded well to those changes rather than simply saying we were late.

Could you keep it to around three paragraphs, and make sure that the tone is confident without being boastful?`;

const SYSTEM_PROMPT = `You are a helpful assistant that reviews pull requests for a TypeScript monorepo.

Please make sure to follow these rules when you are reviewing:

- You should always check that the code has tests. If it does not have tests, you must ask for them.
- It is important to note that we use strict TypeScript, so please flag any use of the any type.
- Kindly keep your comments concise and actionable. Do not simply say that something is wrong — explain what you would like the author to do instead.
- If you see a configuration change, make sure to check whether the documentation needs to be updated as well.
- Obviously you should be polite, but you should also be direct.

Here is an example of the format that I would like you to use for each comment:

\`\`\`
file: src/foo.ts:12
severity: blocking | suggestion | nit
comment: <your comment>
\`\`\`

When you are finished, please provide a short summary of the overall quality of the pull request.`;

export const SAMPLES: readonly Sample[] = [
  {
    id: "agent-task",
    label: "Agent task (real traffic)",
    note: "Code, a shell command, a stack trace, a URL and a path — prose only between the tool calls.",
    text: AGENT_TASK,
  },
  {
    id: "chat-prose",
    label: "Chat prose (the benchmark)",
    note: "Almost entirely prose. This is the shape that produces the headline percentages.",
    text: CHAT_PROSE,
  },
  {
    id: "system-prompt",
    label: "System prompt",
    note: "Mixed: instruction prose plus a fenced format block that must survive intact.",
    text: SYSTEM_PROMPT,
  },
] as const;

export const DEFAULT_SAMPLE = SAMPLES[0];
