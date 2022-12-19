import { NS } from "@ns";

export async function main(ns: NS): Promise<void>{
    //debugger;
    const target = ns.args[0] as string;
    if(target == undefined) return;
    const wait = ns.args[1] == undefined ? 0 : ns.args[1] as number;
    await ns.sleep(wait);
    await ns.hack(target);
}