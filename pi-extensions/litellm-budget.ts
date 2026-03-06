/**
 * LiteLLM Budget Extension
 *
 * Auto-detects when pi is talking to a LiteLLM proxy and shows
 * key spend/budget as a footer status line.
 *
 * Detection strategy (in priority order):
 * 1. Response headers on every LLM call:
 *    x-litellm-key-spend, x-litellm-key-max-budget, x-litellm-response-cost
 *    These are returned by LiteLLM on every /chat/completions response.
 * 2. /key/info endpoint probe (fallback for setups that allow it)
 *
 * Optional env overrides:
 *   LITELLM_PROXY_URL  - force proxy URL (for /key/info probe)
 *   LITELLM_API_KEY    - force API key (for /key/info probe)
 *
 * Footer status example:
 *   Budget: $33.17/$300 (11.1%)  [+$0.0002]
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

interface BudgetInfo {
	spend: number;
	maxBudget: number | null;
	budgetDuration: string | null;
	lastCallCost: number | null;
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
	const fmtCost = (n: number) => {
		if (n >= 0.01) return `$${n.toFixed(4)}`;
		return `$${n.toExponential(2)}`;
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

	if (budget.lastCallCost !== null) {
		text += `  [+${fmtCost(budget.lastCallCost)}]`;
	}

	if (pct >= 90) return theme.fg("error", text);
	if (pct >= 70) return theme.fg("warning", text);
	return theme.fg("dim", text);
}

// ---------------------------------------------------------------------------
// Fetch interceptor — harvests LiteLLM budget headers from every response
// ---------------------------------------------------------------------------

type HeaderCallback = (headers: Headers, url: string) => void;

let _interceptorInstalled = false;
const _headerListeners: Set<HeaderCallback> = new Set();

function installFetchInterceptor() {
	if (_interceptorInstalled) return;
	_interceptorInstalled = true;

	const originalFetch = globalThis.fetch.bind(globalThis);
	globalThis.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
		const response = await originalFetch(input, init);

		// Only forward if this looks like a LiteLLM response (has the spend header)
		if (response.headers.has("x-litellm-key-spend")) {
			const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
			for (const cb of _headerListeners) {
				try { cb(response.headers, url); } catch { /* ignore listener errors */ }
			}
		}

		return response;
	} as typeof fetch;
}

function onLiteLLMHeaders(cb: HeaderCallback): () => void {
	installFetchInterceptor();
	_headerListeners.add(cb);
	return () => _headerListeners.delete(cb);
}

// ---------------------------------------------------------------------------
// /key/info fallback (for setups that allow it)
// ---------------------------------------------------------------------------

function keyInfoUrls(baseUrl: string): string[] {
	const normalized = baseUrl.replace(/\/+$/, "");
	const urls = new Set<string>();
	urls.add(`${normalized}/key/info`);
	try {
		const u = new URL(normalized);
		urls.add(`${u.origin}/key/info`);
	} catch { /* ignore */ }
	return Array.from(urls);
}

async function fetchBudgetViaKeyInfo(baseUrl: string, apiKey: string): Promise<BudgetInfo | null> {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

	for (const url of keyInfoUrls(baseUrl)) {
		try {
			const resp = await fetch(url, { headers, signal: AbortSignal.timeout(2500) });
			if (!resp.ok) continue;
			const data = await resp.json();
			const info = data?.info ?? data;
			const spend = parseMaybeNumber(info?.spend);
			if (spend === null) continue;
			return {
				spend,
				maxBudget: parseMaybeNumber(info?.max_budget),
				budgetDuration: typeof info?.budget_duration === "string" ? info.budget_duration : "1d",
				lastCallCost: null,
				sourceUrl: url,
			};
		} catch { /* try next */ }
	}
	return null;
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
	const STATUS_KEY = "litellm-budget";

	// Last known budget state, updated from headers or /key/info
	let budget: BudgetInfo | null = null;
	let uiCtx: any = null; // held so header callback can update the status

	function updateStatus() {
		if (!uiCtx || !budget) return;
		uiCtx.ui.setStatus(STATUS_KEY, formatBudget(budget, uiCtx.ui.theme));
	}

	// Install fetch interceptor once; update budget state whenever headers arrive
	const removeListener = onLiteLLMHeaders((headers, url) => {
		const spend = parseMaybeNumber(headers.get("x-litellm-key-spend"));
		if (spend === null) return;

		const maxBudget = parseMaybeNumber(headers.get("x-litellm-key-max-budget"));
		const lastCallCost = parseMaybeNumber(headers.get("x-litellm-response-cost"));

		budget = {
			spend,
			maxBudget,
			budgetDuration: budget?.budgetDuration ?? "1d", // preserve from /key/info if known, else default to daily
			lastCallCost,
			sourceUrl: url,
		};

		updateStatus();
	});

	async function resolveEndpoint(ctx: any): Promise<{ baseUrl: string; apiKey: string } | null> {
		const envUrl = process.env.LITELLM_PROXY_URL;
		const envKey = process.env.LITELLM_API_KEY;
		if (envUrl) return { baseUrl: envUrl, apiKey: envKey || "" };
		const model = ctx.model;
		if (!model?.baseUrl) return null;
		const apiKey = await ctx.modelRegistry.getApiKey(model);
		return { baseUrl: model.baseUrl, apiKey: apiKey || "" };
	}

	async function probeBudget(ctx: any) {
		uiCtx = ctx;
		const endpoint = await resolveEndpoint(ctx);
		if (!endpoint) return;

		// Try /key/info; if it works we get richer data (budgetDuration etc.)
		const info = await fetchBudgetViaKeyInfo(endpoint.baseUrl, endpoint.apiKey);
		if (info) {
			budget = info;
			updateStatus();
		}
		// If /key/info fails, we'll pick up data from the first real LLM response via headers
	}

	pi.on("session_start", async (_event, ctx) => {
		uiCtx = ctx;
		await probeBudget(ctx);
	});

	pi.on("model_select", async (_event, ctx) => {
		uiCtx = ctx;
		budget = null;
		ctx.ui.setStatus(STATUS_KEY, undefined);
		await probeBudget(ctx);
	});

	pi.on("session_switch", async (_event, ctx) => {
		uiCtx = ctx;
		budget = null;
		ctx.ui.setStatus(STATUS_KEY, undefined);
		await probeBudget(ctx);
	});

	// Keep ctx reference fresh so header callback can call updateStatus
	pi.on("agent_end", async (_event, ctx) => {
		uiCtx = ctx;
	});

	// Manual command
	pi.registerCommand("litellm-budget", {
		description: "Show LiteLLM key budget details",
		handler: async (_args, ctx) => {
			uiCtx = ctx;

			if (!budget) {
				await probeBudget(ctx);
			}

			if (!budget) {
				ctx.ui.notify(
					"No LiteLLM budget data yet.\n" +
					"Make an LLM request first — budget is read from response headers.\n" +
					"Or check that LITELLM_PROXY_URL / LITELLM_API_KEY are set for /key/info fallback.",
					"warning"
				);
				return;
			}

			const fmtDollar = (n: number) => `$${n.toFixed(4)}`;
			const details = [
				`Source: ${budget.sourceUrl}`,
				`Spend:  ${fmtDollar(budget.spend)}`,
				`Max Budget: ${budget.maxBudget !== null ? fmtDollar(budget.maxBudget) : "unlimited"}`,
				`Budget Duration: ${budget.budgetDuration ?? "none"}`,
				...(budget.lastCallCost !== null ? [`Last call cost: $${budget.lastCallCost.toExponential(4)}`] : []),
			].join("\n");

			ctx.ui.notify(details, "info");
		},
	});
}
