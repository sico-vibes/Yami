import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  authorizeUrl,
  pkce,
  Spotify,
  spotifyRedirect,
  waitForCode,
} from "../electron/spotify.ts";

test("PKCE challenge matches its verifier and the sign-in URL is Spotify's", () => {
  const { verifier, challenge, state } = pkce();
  assert.equal(
    createHash("sha256").update(verifier).digest("base64url"),
    challenge,
  );
  assert.match(state, /^[0-9a-f]{32}$/);
  const url = new URL(
    authorizeUrl("0123456789abcdef0123456789abcdef", challenge, state),
  );
  assert.equal(url.origin, "https://accounts.spotify.com");
  assert.equal(url.searchParams.get("redirect_uri"), spotifyRedirect);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.throws(() => authorizeUrl("not-an-id", challenge, state), /Client ID/);
});

test("the loopback callback accepts only the matching state", async () => {
  const good = waitForCode("s1", 47895, 5000);
  await fetch("http://127.0.0.1:47895/callback?code=abc&state=s1");
  assert.equal(await good, "abc");
  const bad = waitForCode("s2", 47895, 5000);
  const res = fetch("http://127.0.0.1:47895/callback?code=abc&state=evil");
  await assert.rejects(bad, /did not match/);
  await res;
});

test("tokens refresh, the refresh token is stored, and Premium errors read plainly", async () => {
  let stored = "";
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push([init.method || "GET", String(url)]);
    if (String(url).endsWith("/api/token"))
      return Response.json({
        access_token: "a1",
        refresh_token: "r1",
        expires_in: 3600,
      });
    if (String(url).endsWith("/me/player") && (init.method || "GET") === "GET")
      return Response.json({
        is_playing: true,
        item: { name: "Song", artists: [{ name: "Band" }] },
        device: { name: "Phone", volume_percent: 40 },
        shuffle_state: false,
        repeat_state: "off",
      });
    if (String(url).endsWith("/me/player/next"))
      return Response.json(
        { error: { status: 403, reason: "PREMIUM_REQUIRED" } },
        { status: 403 },
      );
    return new Response(null, { status: 204 });
  };
  const spotify = new Spotify(
    () => "0123456789abcdef0123456789abcdef",
    { get: () => stored, set: (v) => (stored = v) },
    fetchImpl,
  );
  await assert.rejects(spotify.now(), /Connect Spotify/);
  await spotify.exchange("code", "verifier");
  assert.equal(stored, "r1");
  assert.deepEqual(await spotify.now(), {
    active: true,
    playing: true,
    title: "Song",
    artist: "Band",
    device: "Phone",
    volume: 40,
    shuffle: false,
    repeat: "off",
  });
  await assert.rejects(spotify.act("next"), /needs Premium/);
  await spotify.act("volume", 140);
  assert.ok(
    calls.some(([m, u]) => m === "PUT" && u.endsWith("volume_percent=100")),
    "clamped",
  );
  // Shuffle and repeat go through Spotify's own service.
  await spotify.act("shuffle");
  await spotify.act("repeat");
  assert.ok(
    calls.some(
      ([m, u]) => m === "PUT" && u.endsWith("/me/player/shuffle?state=true"),
    ),
    "shuffle turned on",
  );
  assert.ok(
    calls.some(
      ([m, u]) => m === "PUT" && u.endsWith("/me/player/repeat?state=context"),
    ),
    "repeat moved from off to the playlist",
  );
  await assert.rejects(spotify.act("transfer", "bad id!"), /Choose a device/);
  await assert.rejects(spotify.act("shutdown"), /Unknown/);
  spotify.disconnect();
  assert.equal(stored, "");
});
