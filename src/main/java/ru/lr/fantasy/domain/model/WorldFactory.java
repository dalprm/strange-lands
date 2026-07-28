package ru.lr.fantasy.domain.model;

import ru.lr.fantasy.domain.model.building.BarrackBuilding;
import ru.lr.fantasy.domain.model.building.CastleBuilding;
import ru.lr.fantasy.domain.model.building.WallBuilding;
import ru.lr.fantasy.domain.model.building.WallLevel;

import java.awt.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

public class WorldFactory {
    private Player[] players;
    private Random worthRandom = new Random();

    public WorldFactory(Player... players) {
        this.players = players;
    }

    public World create(int sizeX, int sizeY) {
        if (sizeX < 2 || sizeY < 2) {
            throw new IllegalArgumentException("Минимальные размеры поля 2x2");
        }

        Land[][] completeLands = createLands(sizeX, sizeY);
        if (players != null) {
            createCastles(sizeX, sizeY, completeLands);
        }

        List<Land> allLands = new ArrayList<>();
        for (int i = 0; i < sizeX; i++) {
            for (int j = 0; j < sizeY; j++) {
                allLands.add(completeLands[i][j]);
            }
        }

        World world = new World(allLands, new Dimension(sizeX, sizeY));
        if (players != null) {
            for (Player p : players) {
                if (p != null) {
                    world.ensurePlayerWorldResources(p.getId());
                }
            }
        }
        return world;
    }

    private void createCastles(int sizeX, int sizeY, Land[][] completeLands) {
        for (int i = 0; i < players.length; i++) {
            Land land = getRandomLand(completeLands, sizeX, sizeY);
            land.setPlayer(players[i]);
            initStartingBuildingsForPlayerLand(land);
        }
    }

    /** Стартовая капиталка для земли игрока при создании мира. */
    private void initStartingBuildingsForPlayerLand(Land land) {
        land.addBuilding(new WallBuilding(WallLevel.FORTRESS_LEVEL_3));
        land.addBuilding(new CastleBuilding());
        land.addBuilding(new BarrackBuilding());
        land.addBuilding(new BarrackBuilding());
    }

    private Land[][] createLands(int sizeX, int sizeY) {
        Land[][] completeLands = new Land[sizeX][sizeY];
        int current = 0;

        for (int i = 0; i < sizeX; i++) {
            for (int j = 0; j < sizeY; j++) {
                current++;
                Land land = new Land(current, generateCosts(), generateName(current));
                land.addAccessBuildWarriorType(WarriorType.FIGHTER);
                if (rollOneIn(15)) {
                    land.addAccessBuildWarriorType(WarriorType.ORC);
                }
                if (rollOneIn(10)) {
                    land.addAccessBuildWarriorType(WarriorType.ELF);
                }
                if (rollOneIn(10)) {
                    land.addAccessBuildWarriorType(WarriorType.DWARF);
                }
                if (rollOneIn(20)) {
                    land.addAccessBuildWarriorType(WarriorType.S_ELF);
                }
                if (rollOneIn(10)) {
                    land.addAccessBuildWarriorType(WarriorType.HALF);
                }
                completeLands[i][j] = land;

                if (j != 0) {
                    land.addNeighboring(completeLands[i][j - 1]);
                    completeLands[i][j - 1].addNeighboring(land);
                }

                if (i != 0) {
                    land.addNeighboring(completeLands[i - 1][j]);
                    completeLands[i - 1][j].addNeighboring(land);
                }
            }
        }

        return completeLands;
    }

    private Land getRandomLand(Land[][] allLands, int sizeX, int sizeY) {
        Random random = new Random();
        Land land;
        do {
            land = allLands[random.nextInt(sizeX)][random.nextInt(sizeY)];
        } while (land.hasPlayer());
        return land;
    }

    private String generateName(int landNumber) {
        return String.valueOf(landNumber);
    }

    private int generateCosts() {
        return 999 + worthRandom.nextInt(3002);
    }

    /** Шанс «1 из n» (независимый бросок). */
    private boolean rollOneIn(int n) {
        return worthRandom.nextInt(n) == 0;
    }
}
