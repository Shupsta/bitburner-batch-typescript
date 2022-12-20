import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    ns.disableLog("ALL");

    ns.print("\nTemp");

    const target = ns.args[0] as string;
    if (target == undefined) {
        ns.print("Np target server was specified, ending script");
        return;
    }

    ns.scp("batch-hack.js", target, "home");
    ns.scp("batch-grow.js", target, "home");
    ns.scp("batch-weaken.js", target, "home");

    const hackTime = ns.getHackTime(target);
    const growTime = ns.getGrowTime(target);
    const weakenTime = ns.getWeakenTime(target);
    let bufferTime = ns.args[1] as number;
    if (bufferTime == undefined) bufferTime = 300;

    const hackThreads = ns.args[2] != undefined ? ns.args[2] as number: 11;
    const hackWeakenThreads = ns.args[3] != undefined ? ns.args[3] as number : 1;
    const growThreads = ns.args[4] != undefined ? ns.args[4] as number : 48;
    const growWeakenThreads = ns.args[5] != undefined ? ns.args[5] as number : 5;

    debugger;

    const hack_delay = (weakenTime - bufferTime) - hackTime;
    const grow_delay = (weakenTime + bufferTime) - growTime;
    const weake_delay_2 = (weakenTime + (2 * bufferTime)) - weakenTime;

    for(let i = 0; i < 5; i++){
        ExecThreads(ns, "batch-weaken.js", hackWeakenThreads, [target, (5 * bufferTime)* i]);
        ExecThreads(ns, "batch-weaken.js", growWeakenThreads, [target, weake_delay_2 * i]);
        ExecThreads(ns, "batch-grow.js", growThreads, [target, grow_delay * i]);
        ExecThreads(ns, "batch-hack.js", hackThreads, [target, hack_delay * i]);
        //ns.exec("batch-weaken.js", target, hackWeakenThreads, target, weake_delay_1 * i);
        //ns.exec("batch-weaken.js", target, growWeakenThreads, target, weake_delay_2 * i);
        //ns.exec("batch-grow.js", target, growThreads, target,grow_delay * i);
        //ns.exec("batch-hack.js", target, hackThreads, target, hack_delay * i);
        
    }
    

    ns.tprintf("\nHack Threads | %d", hackThreads);
    ns.tprintf("\nWeaken H Threads | %d", hackWeakenThreads);
    ns.tprintf("\nGrow Threads | %d", growThreads);
    ns.tprintf("\nWeaken G Threads | %d", growWeakenThreads);

    ns.tprintf("\nHack Time | %d", hackTime);
    ns.tprintf("\nWeaken H Time | %d", weakenTime);
    ns.tprintf("\nGrow Time | %d", growTime);
    ns.tprintf("\nWeaken G Time | %d", weakenTime);    

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