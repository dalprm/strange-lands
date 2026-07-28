package ru.lr.fantasy.domain.model;

public class Warrior {
    private WarriorType type;
    private int count;
    private int level;

    public Warrior() {}

    public Warrior(WarriorType type, int count) {
        this.type = type;
        this.count = count;
        this.level = 0;
    }

    public Warrior(WarriorType type, int count, int level) {
        this.type = type;
        this.count = count;
        this.level = level;
    }

    public void setLevel(int level) {
        this.level = level;
    }

    public int getLevel() {
        return level;
    }

    public WarriorType getType() {
        return type;
    }

    public void setType(WarriorType type) {
        this.type = type;
    }

    public int getCount() {
        return count;
    }

    public void setCount(int count) {
        this.count = count;
    }

    public void addCount(int addCount) {
        count += addCount;
    }

    public void removeCount(int removeCount) {
        count -= removeCount;
    }
}
