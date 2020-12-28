// TO DO - add flavor identifying the item and button to roll damage/healing/whatever
export async function ageRollCheck(event, abl, focusRolled, itemRolled, actor) {

    // Set roll mode
    const rMode = setBlind(event);
    
    // All rolls are based on an Abilities
    const ablValue = actor.data.data.abilities[abl].total;

    // Basic formula created spliting Stunt Die from the others
    let rollFormula = "2d6 + 1d6 + @ability";
    let rollData = {
        ability: ablValue,
        ablCode: abl,
        focusId: null
    };

    // Check with Focus is involed in this roll and what is the applicable value for the Actor
    if (focusRolled !== null) {
        rollFormula = `${rollFormula} + @focus`;

        // if focusRolled has an Object, the Actor has focus, then Focus Value is retrieved
        if (typeof focusRolled === "object") {
            rollData = {
                ...rollData,
                // data.focusValue not in use anymore, using only data.initialValue
                focus: focusRolled.data.data.initialValue,
                focusName: focusRolled.name,
                focusId: focusRolled._id
            };
        };

        // If focusRolled is a String, it means the Actor do not have the necessary Focus, then value 0 is sent
        if (typeof focusRolled === "string") {
            rollData = {
                ...rollData,
                focus: 0,
                focusName: focusRolled
            };
        };
    };

    // Transfer rolled item (if any) to chat message
    // Also checks if Item has Activation Mod
    if (itemRolled !== null) {
        rollData.itemId = itemRolled._id;
        if (itemRolled.data.data.itemMods.itemActivation.isActive) {
            rollData.activationMod = itemRolled.data.data.itemMods.itemActivation.value
            rollFormula += " + @activationMod"
        }
    } else {
        rollData.itemId = null;
    };

    // Check if AIM is active - this bonus will apply to all rolls when it is active
    const aim = actor.data.data.aim;
    if (aim.active) {
        rollData.aim = aim.value;
        rollFormula = `${rollFormula} + @aim`;
    };

    // Adds Armor Penalty if it is a Dexterity Check
    const armor = actor.data.data.armor;
    if (armor.penalty > 0 && abl === "dex") {
        rollData.armorPenalty = -armor.penalty;
        rollFormula = `${rollFormula} + @armorPenalty`;
    };   

    // Check if Fatigue is configured
    const usingFatigue = game.settings.get("age-system", "useFatigue");

    // Check for Fatigue penalties
    const fatigue = actor.data.data.fatigue;
    
    // Apply Fatigue penalties, if in use
    if (usingFatigue) {
        if (aim.value > 0) {
            rollData.fatigue = -fatigue.value;
            rollFormula = `${rollFormula} + @fatigue`;
        };
    }

    // Check Guard Up penalties
    // Here it checks if Guard Up and Defend are checked - when both are checked, the rule is use none
    const guardUp = actor.data.data.guardUp;
    if (guardUp.active) {
        rollData.guardUp = -guardUp.testPenalty;
        rollFormula = `${rollFormula} + @guardUp`;
    };

    const ageRoll = new Roll(rollFormula, rollData).roll();
    const rollSummary = ageRollChecker(ageRoll)
    let chatTemplate = "/systems/age-system/templates/rolls/base-age-roll.hbs";

    let cardData = {
        rollInput: rollData,
        roll: ageRoll,
        ageRollSummary: rollSummary,
        owner: actor,
        guardUpActive: guardUp.active
    };

    let chatData = {
        user: game.user._id,
        speaker: ChatMessage.getSpeaker(),
        // whisper: isGMroll(event),
        blind: event.shiftKey,
        roll: ageRoll,
        content: await renderTemplate(chatTemplate, cardData)
    };

    // Compatibility with Dice So Nice
    if (game.modules.get("dice-so-nice") && game.modules.get("dice-so-nice").active) {
        return diceSoNiceRoller(ageRoll, chatData);
    };

    // TODO when blind roll, set message to GM and select another template to all other members

    chatData.sound = CONFIG.sounds.dice;
    return ChatMessage.create(chatData, {rollMode: rMode});
};

// Capture GM ID to whisper
export function isGMroll(event) {
    if (!event.shiftKey) {return false};
    return game.users.filter(u => u.isGM);
};

// Code to decide if roll is PUBLIC or BLIND TO GM
export function setBlind(event) {
    if (event.shiftKey) {
        return "blindroll";
    } else {
        return "roll";
    };
};

export function diceSoNiceRoller(roll, chatData) {
    roll.dice[1].options.colorset = "bronze";
    game.dice3d.showForRoll(roll, game.user, true, chatData.whisper, chatData.blind).then(displayed => ChatMessage.create(chatData));
};


// Code to identify Doubles and pass on dice summary     
export function ageRollChecker(ageRoll) {
    const die1 = ageRoll.dice[0].results[0].result;
    const die2 = ageRoll.dice[0].results[1].result;
    const die3 = ageRoll.dice[1].results[0].result;
    const diffFaces = new Set([die1, die2, die3]).size;
    const rollSummary = {
        dice: {
            d1: die1,
            d2: die2,
            d3: die3
        },
        stunt: false
    };
    if (diffFaces < 3) {rollSummary.stunt = true};    
    return rollSummary
};

export function damageToString(damageMod) {
    return damageMod > 0 ? `+${damageMod}` : `${damageMod}`;
};


// Creates dialog box to pick alternative Ability to roll a Focus - option within Focus' context menu
export function dialogBoxAbilityFocus(focus, actor) {

    let focusDialog = {
        title: focus.data.name,
        content: `<p>${game.i18n.localize("age-system.abilitySelect")}</p>`,
    };
    
    let buttons = {};
    const abilitiesPool = CONFIG.ageSystem.abilities;

    for (const abl in abilitiesPool) {
        if (Object.hasOwnProperty.call(abilitiesPool, abl)) {
            const ablLocalString = abilitiesPool[abl];
            buttons[abl] ={
                label: game.i18n.localize(ablLocalString),
                callback: ev => {
                    ageRollCheck(ev, abl, focus, null, actor)
                }
            }
        };
    };
    
    // In future versions of FoundryVTT (after 0.7.9), Dialog will pass HMTL data and not jQuery
    // Check this if/when code breaks
    return new Dialog(focusDialog = {
        ...focusDialog,
        buttons
    });
};

// Item damage
export function itemDamage(event, item) {

    const nrDice = item.data.data.nrDice;
    const diceSize = item.data.data.diceType;
    const constDmg = item.data.data.extraValue;

    const isBlind = setBlind(event);
    const audience = isGMroll(event);

    let damageFormula = "(@diceQtd)d(@diceSize)";
    let messageData = {
        flavor: `${item.name}`,
        speaker: ChatMessage.getSpeaker()
    };

    // Check if damage source has a non 0 portion on its parameters
    if (constDmg !== 0) {damageFormula = `${damageFormula} + @damageMod`}

    const dmgAbl = item.data.data.dmgAbl;
    let rollData = {
        diceQtd: nrDice,
        diceSize: diceSize,
        damageMod: constDmg
    };


    if (item.isOwned) {

        // Adds owner's Ability to damage
        const ablMod = item.actor.data.data.abilities[dmgAbl].total;
        damageFormula = `${damageFormula} + @abilityMod`;
        rollData.abilityMod = ablMod;
        messageData.flavor += ` | ${damageToString(ablMod)}, ${game.i18n.localize("age-system." + dmgAbl)}`

        // Check if Item has Mod to add to its own Damage
        if (item.data.data.itemMods.itemDamage.isActive) {
            const itemDmg = item.data.data.itemMods.itemDamage.value;
            damageFormula = `${damageFormula} + @itemBonus`;
            rollData.itemBonus = itemDmg;
            messageData.flavor += ` | ${damageToString(itemDmg)}, ${game.i18n.localize("age-system.itemDmgMod")}`;
        };
       

        // Check if item onwer has items which adds up to general damage
        if (item.actor.data.data.ownedBonus != null && item.actor.data.data.ownedBonus.actorDamage) {
            const actorDmgMod = item.actor.data.data.ownedBonus.actorDamage.totalMod;
            damageFormula = `${damageFormula} + @generalDmgMod`;
            rollData.generalDmgMod = actorDmgMod;
            messageData.flavor += ` | ${damageToString(actorDmgMod)}, ${game.i18n.localize("age-system.itemDmgMod")}`;
        };

        // Adds extra damage for All-Out Attack maneuver
        if (item.actor.data.data.allOutAttack.active) {
            const allOutAttackMod = item.actor.data.data.allOutAttack.dmgBonus;
            damageFormula = `${damageFormula} + @allOutAttack`;
            rollData.allOutAttack = allOutAttackMod;
            messageData.flavor += ` | ${damageToString(allOutAttackMod)}, ${game.i18n.localize("age-system.allOutAttack")}`;                
        };

        // Adds extra damage for CTRL + click (+1D6) or CTRL + ALT + click (+2D6)
        if (event.ctrlKey) {
            if (event.altKey) {
                damageFormula = `${damageFormula} + 2d6`
                messageData.flavor += ` | +2D6`;
            } else {
                damageFormula = `${damageFormula} + 1d6`
                messageData.flavor += ` | +1D6`;
            };
        };
    };

    let dmgRoll = new Roll(damageFormula, rollData).roll();

    return dmgRoll.toMessage(messageData, {whisper: audience, rollMode: isBlind});
};