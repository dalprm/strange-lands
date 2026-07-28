package ru.lr.fantasy.domain.model.building;

public enum WallLevel {
    FORTRESS_LEVEL_1("Fortress Level 1", 3),
    FORTRESS_LEVEL_2("Fortress Level 2", 4),
    FORTRESS_LEVEL_3("Fortress Level 3", 5),
    FORTRESS_LEVEL_4("Fortress Level 4", 6);

    private final String name;
    private final int id;

    WallLevel(String name, int id) {
        this.name = name;
        this.id = id;
    }

    @Override
    public String toString() {
        return name;
    }
}
