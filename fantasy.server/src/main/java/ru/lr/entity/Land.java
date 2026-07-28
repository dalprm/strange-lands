package ru.lr.entity;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class Land
{
    private String name;
    private Double costs;
    private Set<Land> neighboring = new HashSet<>();

    private List<Barrack> barracks = new ArrayList<>();
    private Wall wall;

    public Land(String name, Double costs)
    {
        this.name = name;
        this.costs = costs;
    }
}
