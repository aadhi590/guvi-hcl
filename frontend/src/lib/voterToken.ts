// Anonymous voters are identified by a random token persisted in
// localStorage (never a login) so the backend can dedupe votes per
// browser, per CLAUDE.md: "voterToken (uuid, localStorage)".

const VOTER_TOKEN_KEY = "pulse_voter_token";

export function getVoterToken(): string {
  let token = localStorage.getItem(VOTER_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(VOTER_TOKEN_KEY, token);
  }
  return token;
}
