export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("\nTemp");
    const target = ns.args[0];
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
async function ReduceSecurity(ns, target) {
    ns.disableLog("getServerSecurityLevel");
    ns.disableLog("getServerMinSecurityLevel");
    const diff = ns.getServerSecurityLevel(target) - ns.getServerMinSecurityLevel(target);
    ns.printf("\nThe security difference for %s is %d", target, diff);
    const weakenThreads = Math.ceil(diff / 0.05);
    if (weakenThreads == 0)
        return;
    let fired = 0;
    while (fired < weakenThreads) {
        const result = ExecThreads(ns, "batch-weaken.js", weakenThreads, [target, 0]);
        await WaitPIDS(ns, result.pids);
        fired += result.threads;
        ns.printf("\nFired %d threads of %d", fired, weakenThreads);
    }
}
async function GrowMoney(ns, target) {
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
        const pids = Array();
        ns.printf("\nNeed to exacute %d more grow threads | Need to exacute %d more weaken threads.", (growThreads - firedGrow), (weakenThreads - firedWeaken));
        for (const server of servers) {
            const maxRam = ns.getServerMaxRam(server);
            const availRam = (maxRam - ns.getServerUsedRam(server)) * 0.9;
            const availThreads = Math.floor(availRam / ns.getScriptRam("batch-grow.js"));
            if (availThreads < 2)
                continue;
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
            let weakenPid = 0;
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
                if (growPid == 0)
                    continue;
                ns.print("\nSuccess exec grow.");
                firedGrow += tempGrowThreads;
                pids.push(growPid);
            }
            if (firedGrow >= growThreads && firedWeaken >= weakenThreads)
                break;
            await ns.sleep(500);
        }
        ns.print("\nWaiting on pids from last batch of weaken and grows");
        await WaitPIDS(ns, pids);
    }
}
function CalculateThreads(ns, target) {
    const servers = GetAllServers(ns);
    const totalRam = GetTotalRam(ns, servers);
    const totalAvailThreads = Math.floor((totalRam / 1.75) - ns.getScriptRam("batch-run.js"));
    let hackThreads = 1;
    let hackWeakenThreads = 1;
    let growThreads = 1;
    let growWeakenThreads = 1;
    let totalThreads = hackThreads + hackWeakenThreads + growThreads + growWeakenThreads;
    while (totalThreads < totalAvailThreads) {
        hackThreads++;
        const percentStolen = ns.hackAnalyze(target) * hackThreads;
        if (percentStolen > 0.15) {
            hackThreads--;
            break;
        }
        hackWeakenThreads = Math.ceil((0.002 * hackThreads) / 0.05);
        const percentGrow = ns.getServerMoneyAvailable(target) / (ns.getServerMoneyAvailable(target) - (ns.getServerMoneyAvailable(target) * percentStolen));
        growThreads = ns.growthAnalyze(target, percentGrow);
        growWeakenThreads = Math.ceil((0.004 * growThreads) / 0.05);
        totalThreads = hackThreads + hackWeakenThreads + growThreads + growWeakenThreads;
    }
    return { hackThreads: hackThreads, hackWeakenThreads: hackWeakenThreads, growThreads: growThreads, growWeakenThreads: growWeakenThreads };
}
export function GetAllServers(ns) {
    ns.disableLog("scan");
    const servers = ['home'];
    for (const server of servers) {
        const found = ns.scan(server);
        if (server != 'home')
            found.splice(0, 1);
        servers.push(...found);
    }
    return servers;
}
export function GetTotalRam(ns, servers) {
    let total = 0;
    for (const server of servers) {
        total += ns.getServerMaxRam(server);
    }
    return total;
}
export function ExecThreads(ns, script, neededThreads, myArgs) {
    ns.disableLog("getServerMaxRam");
    ns.disableLog("getServerUsedRam");
    ns.disableLog("getScriptRam");
    ns.disableLog("scp");
    ns.disableLog("exec");
    const servers = SortByMostAvailableRam(ns, GetAllServers(ns));
    const pids = Array();
    let firedThreads = 0;
    for (const server of servers) {
        const availRam = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
        let availThreads = Math.floor(availRam / ns.getScriptRam(script));
        if (availThreads <= 0)
            continue;
        if (availThreads > (neededThreads - firedThreads))
            availThreads = neededThreads - firedThreads;
        ns.scp(script, server, "home");
        const pid = ns.exec(script, server, availThreads, ...myArgs);
        if (pid == 0)
            continue;
        else
            pids.push(pid);
        firedThreads += availThreads;
        if (firedThreads >= neededThreads)
            break;
    }
    return { threads: firedThreads, pids: pids };
}
function SortByMostAvailableRam(ns, servers) {
    ns.disableLog("getServerMaxRam");
    ns.disableLog("getServerUsedRam");
    return servers.sort(SortByAvailable);
    function SortByAvailable(a, b) {
        if (a == "home")
            return 1;
        if (b == "home")
            return -1;
        const maxA = ns.getServerMaxRam(a);
        const maxB = ns.getServerMaxRam(b);
        const availA = maxA - ns.getServerUsedRam(a);
        const availB = maxB - ns.getServerUsedRam(b);
        if (availA > availB)
            -1;
        else if (availA < availB)
            1;
        else {
            if (maxA > maxB)
                return -1;
            else if (maxA < maxB)
                1;
            else
                return 0;
        }
        return 0;
    }
}
export async function WaitPIDS(ns, pids) {
    ns.disableLog("isRunning");
    ns.disableLog("sleep");
    if (pids == undefined || pids.length == 0)
        return;
    for (const pid of pids) {
        if (ns.isRunning(pid))
            ns.printf("\nWaiting for %s", pid);
        while (ns.isRunning(pid)) {
            await ns.sleep(3000);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF0Y2gtcHJlcC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9iYXRjaC1wcmVwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUVBLE1BQU0sQ0FBQyxLQUFLLFVBQVUsSUFBSSxDQUFDLEVBQU07SUFDL0IsRUFBRSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUVyQixFQUFFLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRW5CLE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFXLENBQUM7SUFDcEMsSUFBSSxNQUFNLElBQUksU0FBUyxFQUFFO1FBQ3ZCLEVBQUUsQ0FBQyxLQUFLLENBQUMsK0NBQStDLENBQUMsQ0FBQztRQUMxRCxPQUFPO0tBQ1I7SUFFRCxFQUFFLENBQUMsS0FBSyxDQUFDLG1DQUFtQyxDQUFDLENBQUM7SUFDOUMsTUFBTSxjQUFjLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBRWpDLEVBQUUsQ0FBQyxLQUFLLENBQUMsNEJBQTRCLENBQUMsQ0FBQztJQUN2QyxNQUFNLFNBQVMsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFFNUIsRUFBRSxDQUFDLEtBQUssQ0FBQywrREFBK0QsQ0FBQyxDQUFDO0lBQzFFLE1BQU0sY0FBYyxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQztJQUVqQyxFQUFFLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFFdkMsTUFBTSxTQUFTLEdBQUcsZ0JBQWdCLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBRS9DLEVBQUUsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxTQUFTLENBQUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxpQkFBaUIsRUFBRSxTQUFTLENBQUMsV0FBVyxFQUFF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