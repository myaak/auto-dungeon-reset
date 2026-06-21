const config = require('./config.json');

module.exports = function AutoResetMod(mod) {
    const cmd = mod.command || mod.require.command;
    const items = new Set();
    const bosses = new Map();
    const configBosses = new Map((config.resetBosses ?? []).map((boss) => [`${boss.huntingZoneId}|${boss.templateId}`, boss]));
    let resetOptions = {};
    let enabled = config.enabled;
    let isPatryLeader = false;

    const GREEN  = (s) => `<font color="#33DD33">${s}</font>`;
    const RED = (s) => `<font color="#FF4040">${s}</font>`;
    const HL  = (s) => `<font color="#FFD24D">${s}</font>`;

    cmd.add('adr', {
        $default() {
            enabled = !enabled;
            mod.command.message(`${enabled ? GREEN('enabled') : RED('disabled')}`);
        },
        c() {
            resetOptions = {};
            mod.command.message(GREEN('Auto dungeon reset cancelled'));
        }
    });

    const getBoss = (npc) => {
        return configBosses.get(`${npc.huntingZoneId}|${npc.templateId}`);
    }

    mod.hook('S_LOAD_TOPO', 'event', () => {
        items.clear();
        bosses.clear();
        resetOptions = {};
    });

    mod.hook('S_SPAWN_NPC', '*', (e) => {
        const configBoss = configBosses.get(`${e.huntingZoneId}|${e.templateId}`);
        if (!configBoss) {
            return;
        }
        bosses.set(e.gameId, {
            huntingZoneId: e.huntingZoneId,
            templateId: e.templateId
        });
        mod.command.message(`Auto reset after boss: ${configBoss.name}`);
    });

    mod.hook('S_DESPAWN_NPC', '*', (e) => {
        if (!enabled) {
            return;
        }
        const npc = bosses.get(e.gameId);
        bosses.delete(e.gameId);
        if (!npc) return;

        if (e.type !== 5) return;

        const definedBoss = getBoss(npc);

        if (definedBoss) {
            mod.command.message(`Waiting for loot stage. ${HL('adr c')} to cancel`);
            resetOptions = { need: true, boss: definedBoss };
        }
    });

    mod.hook('S_CHANGE_PARTY_MANAGER', '*', (e) => {
        isPatryLeader = mod.game.me.playerId === e.playerId;
    });

    mod.hook('S_PARTY_MEMBER_LIST', '*', (e) => {
       isPatryLeader = mod.game.me.playerId === e.leader.playerId;
    });

    mod.hook('S_SPAWN_DROPITEM', '*', (e) => {
        if (!enabled) {
            return;
        }
        items.add(e.gameId);
    });

    mod.hook('S_LEAVE_PARTY', '*', () => {
        isPatryLeader = false;
    });

    mod.hook('S_VOTE_RESET_ALL_DUNGEON', '*', () => {
        if (!enabled) {
            return;
        }

        if (resetOptions.need && !isPatryLeader) {
            mod.send('C_VOTE_RESET_ALL_DUNGEON', '*', { accept: true }, { fake: true });
        }
    });

    mod.hook('C_VOTE_RESET_ALL_DUNGEON', '*', { filter: { fake: null } }, (e) => {
        if (!enabled) {
            return;
        }

        if (resetOptions.need && !isPatryLeader && e.accept) {
            resetOptions = {};
            mod.send('S_COMPLETE_VOTE', '*', {});
        }
    });

    mod.hook('S_DESPAWN_DROPITEM', '*', (e) => {
        if (!enabled) {
            return;
        }
        items.delete(e.gameId);
        
        if (!items.size && resetOptions.need && (isPatryLeader || !!resetOptions?.boss?.solo)) {
            resetOptions = {};
            setTimeout(() => {
                mod.send('C_RESET_ALL_DUNGEON', '*', {});
                mod.command.message(GREEN('Successful auto reset.'));
            }, config.resetDelay || 0);
        }
    });
};