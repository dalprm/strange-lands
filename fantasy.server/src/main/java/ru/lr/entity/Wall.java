package ru.lr.entity;

public class Wall extends Building
{
    private int level;

    public Wall()
    {
        super("Wall");
    }

    public int getLevel()
    {
        return level;
    }

    public void setLevel(int level)
    {
        this.level = level;
    }
}
