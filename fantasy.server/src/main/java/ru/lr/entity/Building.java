package ru.lr.entity;

public abstract class Building
{
    private String name;

    protected Building(String name)
    {
        this.name = name;
    }

    public String getName()
    {
        return name;
    }

    public void setName(String name)
    {
        this.name = name;
    }
}
