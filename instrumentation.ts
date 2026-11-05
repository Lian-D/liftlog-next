/** Runs once when the server starts. Starts the loop that sends rest-timer alerts to locked phones. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startAlarmLoop } = await import("./lib/server/push");
  startAlarmLoop();
}
