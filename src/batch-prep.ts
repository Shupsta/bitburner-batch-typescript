import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL");

  ns.print("\nTemp");

  const target = ns.args[0] as string;
  if (target == undefined) {
    ns.print("Np target server was specified, ending script");
    return;
  }

  ns.print("\nTime to reduce security to min.");
  await ReduceSecurity(ns, target);

  ns.print("\nTime to grow the server.");
  await GrowMoney(ns, target);

  ns.print("\nTime to reduce security to min..... again. Just to be safe.");
  await ReduceSecurity(ns, target);

  ns.scp("batch-run.js", target, "home");

  const threadRes = CalculateThreads(ns, target);

  ns.exec("batch-run.js", target, 1, target, 300, threadRes.hackThreads, threadRes.hackWeakenThreads, threadRes.growThreads, threadRes.growWeakenThreads);

}

async function ReduceSecurity(ns: NS, target: string): Promise<void> {

  ns.disableLog("getServerSecurityLevel");
  ns.disableLog("getServerMinSecurityLevel");

  const diff: number = ns.getServerSecurityLevel(target) - ns.getServerMinSecurityLevel(target);

  ns.printf("\nThe security difference for %s is %d", target, diff);

  const weakenThreads: number = Math.ceil(diff / 0.05);
  if(weakenThreads == 0) return;

  let fired = 0;

  while (fired < weakenThreads) {
    const result = ExecThreads(ns, "batch-weaken.js", weakenThreads, [target, 0]);
    await WaitPIDS(ns, result.pids);
    fired += result.threads;
    ns.printf("\nFired %d threads of %d", fired, weakenThreads);
  }

}

async function GrowMoney(ns: NS, target: string): Promise<void> {

  ns.disableLog("getServerMaxMoney");
  ns.disableLog("getServerMoneyAvailable");
  ns.disableLog("growthAnalyze");
  ns.disableLog("getServerMaxRam");
  ns.disableLog("getServerUsedRam");
  ns.disableLog("getScriptRam");
  ns.disableLog("scp");
  ns.disableLog("exec");
  ns.disableLog("sleep");



  const maxMoney = ns.getServerMaxMoney(target);
  const availMoney = ns.getServerMoneyAvailable(target);

  const percentDiff = maxMoney / availMoney;

  const growThreads = ns.growthAnalyze(target, percentDiff);
  const weakenThreads = (growThreads * 0.004) / 0.05;

  ns.printf("\n%s has %d money available and needs to grow by %d | Grow threads : %d | Weaken threads : %d", target, availMoney, percentDiff, growThreads, weakenThreads);

  const servers = SortByMostAvailableRam(ns, GetAllServers(ns));



  let firedGrow = 0;
  let firedWeaken = 0;

  while (firedGrow < growThreads && firedWeaken < weakenThreads) {
    const pids = Array<number>();

    ns.printf("\nNeed to exacute %d more grow threads | Need to exacute %d more weaken threads.", (growThreads - firedGrow), (weakenThreads - firedWeaken));

    for (const server of servers) {
      const maxRam = ns.getServerMaxRam(server);
      const availRam = (maxRam - ns.getServerUsedRam(server)) * 0.9;
      const availThreads = Math.floor(availRam / ns.getScriptRam("batch-grow.js"));

      if (availThreads < 2) continue;

      let tempGrowThreads = availThreads - 1;
      let tempWeakenThreads = 1;

      while ((tempGrowThreads * 0.004) > (tempWeakenThreads * 0.05)) {
        tempGrowThreads--;
        tempWeakenThreads++;
      }

      if (growThreads <= firedGrow && firedWeaken < weakenThreads) {
        tempWeakenThreads = availThreads;
        tempGrowThreads = 0;
      }


      ns.scp("batch-weaken.js", server, "home");
      ns.scp("batch-grow.js", server, "home");

      let weakenPid = 0
      ns.printf("\nExec %d weaken threads on %s targeting %s", tempWeakenThreads, server, target);

      while (weakenPid == 0) {
        weakenPid = ns.exec("batch-weaken.js", server, tempWeakenThreads, target);
        if (weakenPid == 0) {
          ns.printf("\nNeed to wait for %s to open up before exec weaken.", server);
          await ns.sleep(3000);
        }
      }
      ns.print("\nSuccess exec weaken.");
      firedWeaken += tempWeakenThreads;
      pids.push(weakenPid);

      await ns.sleep(ns.getWeakenTime(server) - ns.getGrowTime(server));

      if (tempGrowThreads > 0) {
        ns.printf("\nExec %d grow threads on %s targeting %s", tempGrowThreads, server, target);
        const growPid = ns.exec("batch-grow.js", server, tempGrowThreads, target);
        if (growPid == 0) continue;
        ns.print("\nSuccess exec grow.");
        firedGrow += tempGrowThreads;
        pids.push(growPid);
      }



      if (firedGrow >= growThreads && firedWeaken >= weakenThreads) break;

      await ns.sleep(500);
    }

    ns.print("\nWaiting on pids from last batch of weaken and grows");
    await WaitPIDS(ns, pids);
  }


}

function CalculateThreads(ns: NS, target: string): {hackThreads: number, hackWeakenThreads: number, growThreads: number, growWeakenThreads: number} {
  const servers = GetAllServers(ns);
  const totalRam: number = GetTotalRam(ns, servers);
  const totalAvailThreads = Math.floor((totalRam / 1.75) - ns.getScriptRam("batch-run.js"));

  let hackThreads = 1;
  let hackWeakenThreads = 1;
  let growThreads = 1;
  let growWeakenThreads = 1;

  let totalThreads = hackThreads + hackWeakenThreads + growThreads + growWeakenThreads;

  

  
  while (totalThreads < totalAvailThreads) {
    hackThreads++;
    const percentStolen = ns.hackAnalyze(target) * hackThreads;

    if(percentStolen > 0.15){
      hackThreads--;
      break;
    }

    hackWeakenThreads = Math.ceil((0.002 * hackThreads) / 0.05);

    const percentGrow = ns.getServerMoneyAvailable(target) / (ns.getServerMoneyAvailable(target) - (ns.getServerMoneyAvailable(target) * percentStolen));

    growThreads = ns.growthAnalyze(target, percentGrow);

    growWeakenThreads = Math.ceil((0.004 * growThreads) / 0.05);

    totalThreads = hackThreads + hackWeakenThreads + growThreads + growWeakenThreads;
  }


  return {hackThreads: hackThreads, hackWeakenThreads: hackWeakenThreads, growThreads: growThreads, growWeakenThreads: growWeakenThreads};
}

export function GetAllServers(ns: NS): string[] {
  ns.disableLog("scan");

  const servers = ['home'];
  for (const server of servers) {
    const found = ns.scan(server);
    if (server != 'home') found.splice(0, 1);
    servers.push(...found);
  }
  return servers;
}

export function GetTotalRam(ns: NS, servers: string[]) {
  let total = 0;
  for (const server of servers) {
    total += ns.getServerMaxRam(server);
  }
  return total;
}

export function ExecThreads(ns: NS, script: string, neededThreads: number, myArgs: (string | number)[]): { threads: number, pids: Array<number> } {
  ns.disableLog("getServerMaxRam");
  ns.disableLog("getServerUsedRam");
  ns.disableLog("getScriptRam");
  ns.disableLog("scp");
  ns.disableLog("exec");

  const servers = SortByMostAvailableRam(ns, GetAllServers(ns));
  const pids = Array<number>();

  let firedThreads = 0;

  for (const server of servers) {
    const availRam = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
    let availThreads = Math.floor(availRam / ns.getScriptRam(script));

    if (availThreads <= 0) continue;

    if (availThreads > (neededThreads - firedThreads)) availThreads = neededThreads - firedThreads;

    ns.scp(script, server, "home");

    const pid = ns.exec(script, server, availThreads, ...myArgs);
    if (pid == 0) continue;
    else pids.push(pid);

    firedThreads += availThreads;

    if(firedThreads >= neededThreads) break;
  }

  return { threads: firedThreads, pids: pids };


}

function SortByMostAvailableRam(ns: NS, servers: string[]): string[] {
  ns.disableLog("getServerMaxRam");
  ns.disableLog("getServerUsedRam");

  return servers.sort(SortByAvailable);
  function SortByAvailable(a: string, b: string): number {
    if (a == "home") return 1;
    if (b == "home") return -1;

    const maxA = ns.getServerMaxRam(a);
    const maxB = ns.getServerMaxRam(b);

    const availA = maxA - ns.getServerUsedRam(a);
    const availB = maxB - ns.getServerUsedRam(b);

    if (availA > availB) -1;
    else if (availA < availB) 1;
    else {
      if (maxA > maxB) return -1;
      else if (maxA < maxB) 1;
      else return 0;
    }

    return 0;
  }
}

export async function WaitPIDS(ns: NS, pids: number[]) {
  ns.disableLog("isRunning");
  ns.disableLog("sleep");

  if (pids == undefined || pids.length == 0) return;

  for (const pid of pids) {
    if (ns.isRunning(pid)) ns.printf("\nWaiting for %s", pid);
    while (ns.isRunning(pid)) {
      await ns.sleep(3000);
    }
  }
}


