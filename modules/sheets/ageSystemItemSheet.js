import {ageSystem} from "../config.js";

export default class ageSystemItemSheet extends ItemSheet {
    constructor(...args) {
        super(...args);
    
        // Expand the default size of different item sheet
        const itemType = this.object.data.type;
        switch (itemType) {
            case "focus":
                this.options.width = this.position.width = "350";
                break;
            case "weapon":
                this.options.width = this.position.width = "530";
                this.options.height = this.position.height = "430";
                break;
            case "talent":
                this.options.width = this.position.width = "400";
                this.options.height = this.position.height = "500";
                break;          
            case "stunts":
                this.options.width = this.position.width = "300";
                break;             
            case "relationship":
                this.options.width = this.position.width = "600";
                this.options.height = this.position.height = "300";
                break;  
            case "membership":
                this.options.width = this.position.width = "295";
                this.options.height = this.position.height = "360";
                break;
            case "power":
                this.options.width = this.position.width = "468";
                this.options.height = this.position.height = "600";
                break;  
            default:
                break;
        };
    };
   
    static get defaultOptions() {        
        
        return mergeObject(super.defaultOptions, {
            height: 340,
            width: 516,
            classes: ["age-system", "sheet", "item", /*`colorset-${ageSystem.colorScheme}`,*/ "colorset-second-tier"],
            tabs: [{
                navSelector: ".add-sheet-tabs",
                contentSelector: ".sheet-tab-section",
                initial: "main"
            }]
        });
    };

    get template() {
        return `systems/age-system/templates/sheets/${this.item.data.type}-sheet.hbs`;
    };

    getData(options) {
        const data = super.getData(options);
        data.item = data.entity;
        data.data = data.entity.data;

        data.config = CONFIG.ageSystem;
        
        // Setting which ability settings will be used
        const ablSelect = game.settings.get("age-system", "abilitySelection");
        data.config.abilities = data.config.abilitiesSettings[ablSelect];
        data.config.wealthMode = game.settings.get("age-system", "wealthType");

        // Sheet color
        data.colorScheme = game.settings.get("age-system", "colorScheme");

        return data;
    };
    
    
    activateListeners(html) {

        if (this.isEditable) {
            if (this.item.data.type === "focus") {
                if (this.item.isOwned) {
                    html.find(".item-card-title").keyup(this._onOwnedFocusNameChange.bind(this));
                };
            };

            if (this.item.data.type === "power") {
                html.find(".toggle-damage").click(this._onToggleDamage.bind(this));
                html.find(".toggle-healing").click(this._onToggleHealing.bind(this));
                html.find(".toggle-fatigue").click(this._onToggleFatigue.bind(this));
                html.find(".toggle-resist").click(this._onToggleResistTest.bind(this));
            };

            // Enable field to be focused when selecting it
            const inputs = html.find("input");
            inputs.focus(ev => ev.currentTarget.select());

        };

        // Actions by sheet owner only
        if (this.item.owner) {
            
        };

        super.activateListeners(html);
    };

    _onToggleDamage(event) {
        const toggleDmg = !this.item.data.data.causeDamage;
        this.item.update({"data.causeDamage": toggleDmg}).then(changed => {
            if (toggleDmg === true) this.item.update({"data.causeHealing": false});
        });
    };

    _onToggleHealing(event) {
        const toggleHealing = !this.item.data.data.causeHealing;
        this.item.update({"data.causeHealing": toggleHealing}).then(changed => {
            if (toggleHealing === true) this.item.update({"data.causeDamage": false});
        });
    };

    _onToggleFatigue(event) {
        const toggleFtg = !this.item.data.data.useFatigue;
        this.item.update({"data.useFatigue": toggleFtg});
    };
    
    _onToggleResistTest(event) {
        const toggleTest = !this.item.data.data.hasTest;
        this.item.update({"data.hasTest": toggleTest});
    };
    
    // Adds an * in front of the owned Focus name whenever the user types a name of another owned Focus
    // => Actors are not allowed to have more than 1 Focus with the same name
    // TODO replace this solution with warning message informing about the name exclusivity and prevent item.name to be changed
    _onOwnedFocusNameChange(event) {
        const itemId = this.item.id;
        const owner = this.item.actor;
        const ownedFoci = owner.itemTypes.focus;

        let nameField = event.target;
        const typedEntry = nameField.value;
        const typedLowerCase = typedEntry.toLowerCase();

        for (let i = 0; i < ownedFoci.length; i++) {
            const e = ownedFoci[i];
            const eName = e.data.data.nameLowerCase;
            const eId = e.id;
            if (eId !== itemId && eName === typedLowerCase) {
                nameField.value = "*" + typedEntry;
            };            
        };
    };
};