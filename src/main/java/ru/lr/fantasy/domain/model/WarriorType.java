package ru.lr.fantasy.domain.model;

public enum WarriorType {
    FIGHTER("Человек", false, 1),
    ORC("Орк", false, 2),
    ELF("Эльф", false, 3),
    DWARF("Гном", false, 4),
    S_ELF("Эльф (S)", false, 5),
    HALF("Хоббит", false, 6),
    CATAPULT("Catapult", false, 7),
    BALISTA("Balista", false, 8),
    TARAN("Taran", false, 9),
    HERO_FIGHTER("Hero fighter", true, 10),
    HERO_DWARF("Hero dwarf", true, 11),
    HERO_ELF("Hero elf", true, 12),
    CLERIC("Cleric", true, 13),
    MAGIC("Magic", true, 14);

    private final String name;
    private final int id;
    private final boolean hero;

    WarriorType(String name, boolean hero, int id) {
        this.name = name;
        this.hero = hero;
        this.id = id;
    }

    public boolean isHero() {
        return hero;
    }

    @Override
    public String toString() {
        return name;
    }
}
