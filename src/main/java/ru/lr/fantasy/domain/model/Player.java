package ru.lr.fantasy.domain.model;

public class Player {
    private int level;
    private String name;
    private Long id;

    public Player() {}

    public Player(int level, String name) {
        this.level = level;
        this.name = name;
    }

    public Player(Long id, int level, String name) {
        this.id = id;
        this.level = level;
        this.name = name;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getLevel() {
        return level;
    }

    public void setLevel(int level) {
        this.level = level;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Player)) {
            return false;
        }
        Player player = (Player) o;
        return id != null && id.equals(player.id);
    }

    @Override
    public int hashCode() {
        return id == null ? 0 : id.hashCode();
    }

    @Override
    public String toString() {
        return "Player{" +
                "id=" + id +
                ", level=" + level +
                ", name='" + name + '\'' +
                '}';
    }
}
