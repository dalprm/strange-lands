package ru.lr.fantasy.domain.model;

/**
 * Ресурсы игрока в рамках одного мира: золото и накопленные запасы маны по школам.
 */
public class PlayerWorldResources {

    private long gold;
    /** Накопленная магическая (аркана) мана. */
    private long arcaneMana;
    /** Накопленная друидская мана. */
    private long druidMana;
    /** Накопленная мана клериков. */
    private long clericMana;

    public PlayerWorldResources() {
        this(0, 0, 0, 0);
    }

    public PlayerWorldResources(long gold, long arcaneMana, long druidMana, long clericMana) {
        this.gold = gold;
        this.arcaneMana = arcaneMana;
        this.druidMana = druidMana;
        this.clericMana = clericMana;
    }

    public static PlayerWorldResources zero() {
        return new PlayerWorldResources();
    }

    public long getGold() {
        return gold;
    }

    public void setGold(long gold) {
        this.gold = gold;
    }

    public long getArcaneMana() {
        return arcaneMana;
    }

    public void setArcaneMana(long arcaneMana) {
        this.arcaneMana = arcaneMana;
    }

    public long getDruidMana() {
        return druidMana;
    }

    public void setDruidMana(long druidMana) {
        this.druidMana = druidMana;
    }

    public long getClericMana() {
        return clericMana;
    }

    public void setClericMana(long clericMana) {
        this.clericMana = clericMana;
    }
}
