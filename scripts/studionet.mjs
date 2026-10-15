// Resumable gasless StudioNet proof runner. Keys stay in the GenLayer CLI keychain.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const plan = JSON.parse(fs.readFileSync(path.join(root, "scripts/demo.json"), "utf8"));
const proofFile = path.join(root, "deployments/studionet.json");
const cli = process.env.GENLAYER_CLI_JS;
if (!cli || !fs.existsSync(cli)) throw Error("Set GENLAYER_CLI_JS to the installed genlayer/dist/index.js.");
const requireCLI = createRequire(path.resolve(cli));
const { createClient, chains } = await import(pathToFileURL(requireCLI.resolve("genlayer-js")).href);
const client = createClient({ chain: chains.studionet, endpoint: "https://studio.genlayer.com/api" });
const git = (...args) => execFileSync("git", args, { cwd: root }).toString().trim();
const sourceCommit = git("rev-parse", "HEAD");
const json = value => JSON.stringify(value, (_, v) => typeof v === "bigint" ? Number(v) : v, 2);
let proof = fs.existsSync(proofFile) ? JSON.parse(fs.readFileSync(proofFile, "utf8")) : null;
if (!proof || proof.schema_version !== 2) {
  assert.equal(git("rev-parse", "origin/main"), sourceCommit, "Push the release before deployment.");
  const start = Math.floor(Date.now() / 1000);
  const blob = execFileSync("git", ["show", sourceCommit + ":" + plan.contract], { cwd: root });
  assert.ok(blob.equals(fs.readFileSync(path.join(root, plan.contract))), "Disk source must equal the Git blob byte-for-byte.");
  proof = { schema_version: 2, network: "studionet", chain_id: 61999, rpc: "https://studio.genlayer.com/api",
    source_commit: sourceCommit, source_path: plan.contract, git_blob: git("rev-parse", sourceCommit + ":" + plan.contract),
    source_sha256: createHash("sha256").update(blob).digest("hex"),
    runner: /py-genlayer:([^"]+)/.exec(blob.toString())[1],
    toolchain: { cli: "0.39.2", sdk: "1.1.8", direct_tests: "0.29.2", linter: "0.11.0" },
    wallets: plan.wallets, start, evidence_kind: "SYNTHETIC_SUBMITTED_TEXT",
    trust_boundary: plan.trust_boundary, transactions: [], readbacks: [], next_step: 0, state: "IN_PROGRESS" };
}
function save() { fs.writeFileSync(proofFile, json(proof) + "\n"); }
const expand = value => {
  if (Array.isArray(value)) return value.map(expand);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, expand(v)]));
  if (typeof value !== "string") return value;
  if (value.startsWith("$NOW+")) return Math.floor(Date.now() / 1000) + Number(value.slice(5));
  if (value.startsWith("$START+")) return proof.start + Number(value.slice(7));
  if (value.startsWith("$WALLET:")) return plan.wallets[value.slice(8)].address;
  if (value.startsWith("$HASH:")) return createHash("sha256").update(JSON.stringify(expand(JSON.parse(value.slice(6))))).digest("hex");
  return value;
};
async function rpc(method, params) {
  const response = await fetch(proof.rpc, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error("RPC HTTP " + response.status);
  const body = await response.json();
  if (body.error) throw Error(JSON.stringify(body.error));
  return body.result;
}
async function command(args, onHash) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd: root, windowsHide: true, env: { ...process.env, NO_COLOR: "1" } });
    let output = "", captured = "";
    const timer = setTimeout(() => { child.kill(); reject(Error("CLI timed out; inspect persisted hash before retrying.")); }, 120000);
    child.stdout.on("data", data => {
      output += data;
      const match = output.match(/(?:Deployment|Write) Transaction Hash:\s*(0x[0-9a-fA-F]{64})/);
      if (match && !captured && onHash) { captured = match[1]; onHash(captured); child.kill(); }
    });
    child.stderr.on("data", data => { output += data; });
    child.on("error", reject);
    child.on("close", code => {
      clearTimeout(timer);
      if (captured || code === 0) resolve(output);
      else reject(Error("CLI failed before a recorded hash: " + output.slice(-2500)));
    });
  });
}
async function receipt(tx) {
  const until = Date.now() + 15 * 60000;
  while (Date.now() < until) {
    const result = await rpc("eth_getTransactionByHash", [tx.hash]);
    if (result) {
      tx.lifecycle = result.status; save();
      if (result.status === "FINALIZED") {
        const rows = result.consensus_data?.leader_receipt ?? [];
        const leaders = (Array.isArray(rows) ? rows : [rows]).filter(row => row.mode === "leader");
        const leader = leaders.at(-1);
        assert.ok(leader, "No leader receipt in final transaction.");
        tx.execution = leader.execution_result;
        tx.diagnostics = leader.genvm_result;
        tx.return_base64 = leader.result;
        tx.votes = result.consensus_data?.votes ?? {};
        tx.validator_models = (result.consensus_data?.validators ?? []).map(row => ({
          address: row.node_config?.address, model: row.node_config?.primary_model?.model ?? row.node_config?.model,
          vote: row.vote, execution: row.execution_result
        }));
        tx.leader_receipts = (Array.isArray(rows) ? rows : [rows]).map(row => ({ mode: row.mode, vote: row.vote, execution: row.execution_result }));
        if (tx.kind === "deploy") proof.contract_address = result.data?.contract_address;
        save();
        const diagnostic = JSON.stringify(tx.diagnostics) + Buffer.from(tx.return_base64 ?? "", "base64").toString();
        if (tx.expected_error) {
          assert.equal(tx.execution, "ERROR", "Expected guard did not reject.");
          assert.ok(diagnostic.includes(tx.expected_error), "Unexpected error: " + diagnostic);
        } else {
          assert.equal(tx.execution, "SUCCESS", "Unexpected execution failure: " + diagnostic);
        }
        console.log(tx.id + ": FINALIZED / " + tx.execution);
        return;
      }
      if (["UNDETERMINED", "CANCELED"].includes(result.status)) throw Error("Nonfinal terminal state " + result.status);
    }
    await new Promise(resolve => setTimeout(resolve, 15000));
  }
  throw Error("Receipt deadline exceeded; resume the existing hash, do not resubmit.");
}
try {
  for (; proof.next_step < plan.steps.length; proof.next_step++) {
    const step = expand(plan.steps[proof.next_step]);
    if (step.not_before_arg !== undefined) step.not_before = Number(proof.constructor_args[step.not_before_arg]) + 1;
    if (step.not_before && Date.now() / 1000 < step.not_before) {
      proof.resume_after = new Date(step.not_before * 1000).toISOString(); save();
      console.log("WAIT until " + proof.resume_after + "; rerun the same command to resume.");
      process.exit(0);
    }
    delete proof.resume_after;
    if (step.kind === "read") {
      const value = await client.readContract({ address: proof.contract_address, functionName: step.method, args: step.args ?? [], stateStatus: "finalized" });
      for (const [key, expected] of Object.entries(step.expect ?? {})) assert.deepEqual(value[key], expected, step.id + "." + key);
      proof.readbacks.push({ contract_address: proof.contract_address, id: step.id, method: step.method, args: step.args ?? [], value, observed_at: new Date().toISOString() });
      console.log(step.id + ": readback verified"); save(); continue;
    }
    let tx = proof.transactions.find(row => row.id === step.id);
    if (!tx) {
      tx = { contract_address: step.kind === "deploy" ? null : proof.contract_address, id: step.id, kind: step.kind, method: step.method, args: step.args ?? [], sender: plan.wallets[step.wallet ?? "owner"].address, expected_error: step.expected_error ?? null, lifecycle: "NOT_SUBMITTED" };
      proof.transactions.push(tx); save();
    }
    if (!tx.hash) {
      if (tx.lifecycle === "SUBMISSION_UNCERTAIN") throw Error("Previous submission uncertain; reconcile before signing again.");
      await command(["account", "use", plan.wallets[step.wallet ?? "owner"].account]);
      const args = step.kind === "deploy" ? ["deploy", "--contract", plan.contract] : ["write", proof.contract_address, step.method];
      if (tx.args.length) args.push("--args", ...tx.args.map(arg => typeof arg === "string" && /^0x[0-9a-fA-F]{40}$/.test(arg) ? arg : JSON.stringify(arg)));
      tx.lifecycle = "SUBMISSION_UNCERTAIN"; save();
      await command(args, hash => { tx.hash = hash; tx.lifecycle = "SUBMITTED"; save(); console.log(step.id + ": submitted " + hash); });
      if (!tx.hash) throw Error("No transaction hash; inspect CLI/network before any retry.");
    }
    await receipt(tx);
    if (step.kind === "deploy") {
      assert.ok(proof.contract_address, "Deployment did not produce an address.");
      const deployed = Buffer.from(await rpc("gen_getContractCode", [proof.contract_address]), "base64");
      const blob = execFileSync("git", ["show", proof.source_commit + ":" + plan.contract], { cwd: root });
      assert.ok(deployed.equals(blob), "On-chain source differs from the exact Git blob.");
      proof.deployed_source_byte_identical = true;
      proof.constructor_args = tx.args;
      tx.contract_address = proof.contract_address;
      proof.deployments ??= [];
      if (!proof.deployments.some(row => row.transaction_hash === tx.hash)) proof.deployments.push({ contract_address: proof.contract_address, transaction_hash: tx.hash, constructor_args: tx.args, source_byte_identical: true });
      save();
    }
  }
  proof.state = "VERIFIED_STUDIONET"; delete proof.failure; save();
  console.log("Complete: " + proof.contract_address);
} catch (error) {
  proof.failure = { at_step: proof.next_step, message: error.message, observed_at: new Date().toISOString() };
  save(); console.error(error.message); process.exitCode = 1;
}
