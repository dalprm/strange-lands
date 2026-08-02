package ru.lr.fantasy.domain.model;

import com.fasterxml.jackson.annotation.JsonIdentityInfo;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.ObjectIdGenerators;
import ru.lr.fantasy.domain.model.building.Buildings;
import ru.lr.fantasy.domain.model.building.Building;
import ru.lr.fantasy.domain.model.visitors.BuildingVisitorNewBuilding;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@JsonIdentityInfo(generator = ObjectIdGenerators.PropertyGenerator.class, property = "id")
public class Land implements Comparable<Land> {
    private Long id;
    private String name;
    private int costs;
    private Player player;
    private Buildings buildings;
    private List<Warrior> warriors = new ArrayList<>();
    private List<WarriorType> accessBuildWarriorTypes = new ArrayList<>();
    private List<Land> neighboring = new ArrayList<>();
    /** Владелец уже назначен приказом на нейтраль, гарнизон ещё в пути. */
    private boolean claimPending;

    public Land() {
        this.buildings = new Buildings();
    }

    public Land(int id, int costs, String name) {
        this.id = (long) id;
        this.costs = costs;
        this.name = name;
        this.buildings = new Buildings();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getCosts() {
        return costs;
    }

    public void setCosts(int costs) {
        this.costs = costs;
    }

    public Player getPlayer() {
        return player;
    }

    public void setPlayer(Player player) {
        this.player = player;
    }

    public Buildings getBuildings() {
        return buildings;
    }

    public void setBuildings(Buildings buildings) {
        this.buildings = buildings;
    }

    public List<Warrior> getWarriors() {
        return warriors;
    }

    public void setWarriors(List<Warrior> warriors) {
        this.warriors = warriors;
    }

    public List<WarriorType> getAccessBuildWarriorTypes() {
        return Collections.unmodifiableList(accessBuildWarriorTypes);
    }

    public void addAccessBuildWarriorType(WarriorType warriorType) {
        accessBuildWarriorTypes.add(warriorType);
    }

    /**
     * В JSON не отдаём: граф соседей заставляет Jackson дедуплицировать {@link Land} по id, из‑за чего в {@code world.lands}
     * часть элементов превращается в голое число без {@code player} — ломается карта в UI.
     */
    @JsonIgnore
    public List<Land> getNeighboring() {
        return neighboring;
    }

    public void setNeighboring(List<Land> neighboring) {
        this.neighboring = neighboring;
    }

    public void addNeighboring(Land land) {
        neighboring.add(land);
    }

    public boolean hasPlayer() {
        return player != null;
    }

    public boolean isClaimPending() {
        return claimPending;
    }

    public void setClaimPending(boolean claimPending) {
        this.claimPending = claimPending;
    }

    public void addWarriors(Warrior... addWarriors) {
        List<Warrior> copyWarriors = new ArrayList<>(warriors);
        for (Warrior addWarrior : addWarriors) {
            boolean newTypeWarrior = true;
            for (Warrior warrior : copyWarriors) {
                if (warrior.getType() == addWarrior.getType()
                        && warrior.getLevel() == addWarrior.getLevel()
                        && !warrior.getType().isHero()) {
                    warrior.addCount(addWarrior.getCount());
                    newTypeWarrior = false;
                    break;
                }
            }
            if (newTypeWarrior) {
                warriors.add(addWarrior);
            }
        }
    }

    public void removeWarriors(Warrior... removeWarriors) {
        List<Warrior> copyWarriors = new ArrayList<>(warriors);

        for (Warrior removeWarrior : removeWarriors) {
            for (Warrior warrior : copyWarriors) {
                if (warrior.getType() == removeWarrior.getType()
                        && warrior.getLevel() == removeWarrior.getLevel()) {
                    warrior.removeCount(removeWarrior.getCount());
                    if (warrior.getCount() <= 0) {
                        warriors.remove(warrior);
                    }
                    break;
                }
            }
        }
    }

    public void newRecruits(WarriorType warriorType, int count) {
        addWarriors(new Warrior(warriorType, count));
    }

    public void addBuilding(Building building) {
        building.acceptBuildingVisitor(new BuildingVisitorNewBuilding(buildings));
    }

    @Override
    public int compareTo(Land land) {
        return this.id.compareTo(land.getId());
    }
}
