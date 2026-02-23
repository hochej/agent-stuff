/**
 * LiteLLM Budget Extension
 *
 * Auto-detects when pi is talking to a LiteLLM proxy and shows
 * key spend/budget as a footer status line.
 *
 * Detection strategy:
 * - Uses active model baseUrl + API key (or env overrides)
 * - Probes /key/info
 * - If response looks like LiteLLM budget data, status is shown
 * - Otherwise stays silent
 *
 * Optional env overrides:
 *   LITELLM_PROXY_URL  - force proxy URL
 *   LITELLM_API_KEY    - force API key
 *
 * Footer status example:
 *   Budget: $2.35/$100/30d (2.4%)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

interface BudgetInfo {
	spend: number;
	maxBudget: number | null;
	budgetDuration: string | null;
	sourceUrl: string;
}

function parseMaybeNumber(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value === "string" && value.trim().length > 0) {
		const n = Number(value);
		return Number.isFinite(n) ? n : null;
	}
	return null;
}

function keyInfoUrls(baseUrl: string): string[] {
	const normalized = baseUrl.replace(/\/+$/, "");
	const urls = new Set<string>();
	urls.add(`${normalized}/key/info`);

	// Fallback: if baseUrl has a path (e.g. /v1), also try origin/key/info
	try {
		const u = new URL(normalized);
		urls.add(`${u.origin}/key/info`);
	} catch {
		// ignore URL parsing failures
	}

	return Array.from(urls);
}

function formatDuration(d: string | null): string {
	if (!d) return "";
	const match = d.match(/^(\d+)([smhd])$/i);
	if (!match) return `/${d}`;
	const [, num, unit] = match;
	return `/${num}${unit.toLowerCase()}`;
}

function formatBudget(budget: BudgetInfo, theme: any): string {
	const fmtDollar = (n: number) => {
		if (n >= 100) return `$${n.toFixed(0)}`;
		if (n >= 10) return `$${n.toFixed(1)}`;
		return `$${n.toFixed(2)}`;
	};

	const duration = formatDuration(budget.budgetDuration);
	let text: string;
	let pct = 0;

	if (budget.maxBudget !== null && budget.maxBudget > 0) {
		pct = (budget.spend / budget.maxBudget) * 100;
		text = `Budget: ${fmtDollar(budget.spend)}/${fmtDollar(budget.maxBudget)}${duration} (${pct.toFixed(1)}%)`;
	} else {
		text = `Budget: ${fmtDollar(budget.spend)}${duration}`;
	}

	// Match built-in context color thresholds
	if (pct >= 90) return theme.fg("error", text);
	if (pct >= 70) return theme.fg("warning", text);
	return theme.fg("dim", text);
}

async function fetchBudgetInfo(baseUrl: string, apiKey: string): Promise<BudgetInfo | null> {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

	for (const url of keyInfoUrls(baseUrl)) {
		try {
			const resp = await fetch(url, { headers, signal: AbortSignal.timeout(2500) });
			if (!resp.ok) continue;

			const data = await resp.json();
			const info = data?.info ?? data;

			const spend = parseMaybeNumber(info?.spend);
			if (spend === null) continue; // not LiteLLM-ish budget payload

			return {
				spend,
				maxBudget: parseMaybeNumber(info?.max_budget),
				budgetDuration:
					typeof info?.budget_duration === "string" ? info.budget_duration : null,
				sourceUrl: url,
			};
		} catch {
			// try next candidate URL
		}
	}

	return null;
}

export default function (pi: ExtensionAPI) {
	const STATUS_KEY = "litellm-budget";
	let isLiteLLM = false;
	let refreshSeq = 0;

	const clearStatus = (ctx: any) => ctx.ui.setStatus(STATUS_KEY, undefined);

	async function resolveEndpoint(ctx: any): Promise<{ baseUrl: string; apiKey: string } | null> {
		const envUrl = process.env.LITELLM_PROXY_URL;
		const envKey = process.env.LITELLM_API_KEY;
		if (envUrl) return { baseUrl: envUrl, apiKey: envKey || "" };

		const model = ctx.model;
		if (!model?.baseUrl) return null;

		const apiKey = await ctx.modelRegistry.getApiKey(model);
		return { baseUrl: model.baseUrl, apiKey: apiKey || "" };
	}

	async function refreshBudget(ctx: any, opts?: { forceProbe?: boolean }) {
		const seq = ++refreshSeq;
		const forceProbe = opts?.forceProbe ?? false;

		const endpoint = await resolveEndpoint(ctx);
		if (seq !== refreshSeq) return; // stale async result

		if (!endpoint) {
			if (!isLiteLLM || forceProbe) clearStatus(ctx);
			return;
		}

		const budget = await fetchBudgetInfo(endpoint.baseUrl, endpoint.apiKey);
		if (seq !== refreshSeq) return; // stale async result

		if (budget) {
			isLiteLLM = true;
			ctx.ui.setStatus(STATUS_KEY, formatBudget(budget, ctx.ui.theme));
		} else {
			if (forceProbe) isLiteLLM = false;
			if (!isLiteLLM) clearStatus(ctx);
		}
	}

	// Probe on session start
	pi.on("session_start", async (_event, ctx) => {
		await refreshBudget(ctx, { forceProbe: true });
	});

	// Re-probe when model changes
	pi.on("model_select", async (_event, ctx) => {
		isLiteLLM = false;
		clearStatus(ctx);
		await refreshBudget(ctx, { forceProbe: true });
	});

	// Refresh after each completed assistant response
	pi.on("agent_end", async (_event, ctx) => {
		if (isLiteLLM) await refreshBudget(ctx);
	});

	// Re-probe on session switch
	pi.on("session_switch", async (_event, ctx) => {
		isLiteLLM = false;
		clearStatus(ctx);
		await refreshBudget(ctx, { forceProbe: true });
	});

	// Manual command
	pi.registerCommand("litellm-budget", {
		description: "Show LiteLLM key budget details or force a refresh",
		handler: async (_args, ctx) => {
			const endpoint = await resolveEndpoint(ctx);
			if (!endpoint) {
				ctx.ui.notify("No active model with a base URL configured.", "warning");
				return;
			}

			const budget = await fetchBudgetInfo(endpoint.baseUrl, endpoint.apiKey);
			if (!budget) {
				ctx.ui.notify(
					`No LiteLLM budget endpoint found at ${endpoint.baseUrl}. ` +
						`(Tip: /key/info needs LiteLLM auth+DB in most setups.)`,
					"error"
				);
				return;
			}

			isLiteLLM = true;
			ctx.ui.setStatus(STATUS_KEY, formatBudget(budget, ctx.ui.theme));

			const fmtDollar = (n: number) => `$${n.toFixed(4)}`;
			const details = [
				`Key info URL: ${budget.sourceUrl}`,
				`Spend: ${fmtDollar(budget.spend)}`,
				`Max Budget: ${budget.maxBudget !== null ? fmtDollar(budget.maxBudget) : "unlimited"}`,
				`Budget Duration: ${budget.budgetDuration ?? "none"}`,
			].join("\n");

			ctx.ui.notify(details, "info");
		},
	});
}
