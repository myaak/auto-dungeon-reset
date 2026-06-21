const config = require('./config.json');

module.exports = function AutoResetMod(mod) {
    const cmd = mod.command || mod.require.command;
    const items = new Set();
    const bosses = new Map();
    let needReset = false;
    let enabled = config.enabled;
    let isPatryLeader = false;

    const GREEN  = (s) => `<font color="#33DD33">${s}</font>`;
    const RED = (s) => `<font color="#FF4040">${s}</font>`;
    const HL  = (s) => `<font color="#FFD24D">${s}</font>`;

    cmd.add('ar', {
        $default() {
            enabled = !enabled;
            mod.command.message(`${enabled ? GREEN('enabled') : RED('disabled')}`);
        },
        c() {
            needReset = false;
            mod.command.message(GREEN('Auto reset cancelled'));
        }
    });

    const isResetBoss = (npc) =>
        config.resetBosses.some(b =>
            b.huntingZoneId === npc.huntingZoneId && b.templateId === npc.templateId
        );

    mod.hook('S_LOAD_TOPO', 'event', () => {
        items.clear();
        bosses.clear();
        needReset = false;
    });

    mod.hook('S_SPAWN_NPC', '*', (e) => {
        bosses.set(e.gameId, {
            huntingZoneId: e.huntingZoneId,
            templateId: e.templateId
        });
    });

    mod.hook('S_DESPAWN_NPC', '*', (e) => {
        if (!enabled) {
            return;
        }
        const npc = bosses.get(e.gameId);
        bosses.delete(e.gameId);
        if (!npc) return;

        if (e.type !== 5) return;

        if (isResetBoss(npc)) {
            mod.command.message(`Reset boss killed ${HL('ar c')} to cancel`);
            needReset = true;
        }
    });

    mod.hook('S_PARTY_INFO', '*', (e) => {
       isPatryLeader = mod.game.me.gameId === e.leader;
    });

    mod.hook('S_SPAWN_DROPITEM', '*', (e) => {
        if (!enabled) {
            return;
        }
        items.add(e.gameId);
    });

    mod.hook('C_VOTE_RESET_ALL_DUNGEON', '*', (e) => {
        if (!enabled) {
            return;
        }

        if (needReset && !isPatryLeader) {
            needReset = false;
            e.accept = true;
            return true;
        }
    });

    mod.hook('S_DESPAWN_DROPITEM', '*', (e) => {
        if (!enabled) {
            return;
        }
        items.delete(e.gameId);
        
        if (!items.size && needReset && isPatryLeader) {
            needReset = false;
            setTimeout(() => {
                mod.command.message(GREEN('Automatically reset'));
                mod.send('C_RESET_ALL_DUNGEON', '*', {});
            }, config.resetDelay || 0);
        }
    });
};