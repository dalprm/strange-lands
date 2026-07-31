package ru.lr.fantasy.domain.model.building;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;

public class Buildings {
    private static final int MAX_BUILDINGS = 6;

    private boolean hasCastle;
    private int barrackCount;
    private int magicCastleCount;
    private int clericCastleCount;
    private WallLevel wallLevel;
    private boolean canBuildMagicCastle;
    private boolean canBuildClericCastle;

    public Buildings() {}

    /** Явное имя для JSON: иначе Jackson для {@code hasCastle()} может дать другое свойство, и UI не увидит замок. */
    @JsonProperty("hasCastle")
    public boolean hasCastle() {
        return hasCastle;
    }

    public boolean hasWall() {
        return wallLevel != null;
    }

    public boolean canBuildMagicCastle() {
        return canBuildMagicCastle;
    }

    public boolean canBuildClericCastle() {
        return canBuildClericCastle;
    }

    public boolean canBuildMore() {
        return barrackCount + magicCastleCount + clericCastleCount < MAX_BUILDINGS;
    }

    public static int maxCountableBuildings() {
        return MAX_BUILDINGS;
    }

    public void buildCastle() {
        if (hasCastle) {
            throw new IllegalStateException("На земле уже есть замок");
        }
        hasCastle = true;
    }

    public void buildBarrack() {
        assertCanBuildCountable("казарму");
        barrackCount++;
    }

    public void buildMagicCastle() {
        assertCanBuildCountable("магический замок");
        magicCastleCount++;
    }

    public void buildClericCastle() {
        assertCanBuildCountable("замок клирика");
        clericCastleCount++;
    }

    public void buildWall(WallLevel level) {
        if (level == null) {
            throw new IllegalStateException("Уровень стены не задан");
        }
        if (wallLevel != null && level.ordinal() <= wallLevel.ordinal()) {
            throw new IllegalStateException("Стену можно только улучшить до более высокого уровня");
        }
        this.wallLevel = level;
    }

    private void assertCanBuildCountable(String what) {
        if (!canBuildMore()) {
            throw new IllegalStateException(
                    "Нельзя построить " + what + ": лимит зданий (" + MAX_BUILDINGS + ") исчерпан");
        }
    }

    public void destroyCastle() {
        hasCastle = false;
    }

    public void destroyBarrack() {
        if (barrackCount != 0)
            barrackCount--;
    }

    public void destroyMagicCastle() {
        if (magicCastleCount != 0)
            magicCastleCount--;
    }

    public void destroyClericCastle() {
        if (clericCastleCount != 0)
            clericCastleCount--;
    }

    public void destroyWall() {
        wallLevel = null;
    }

    public void setCanBuildMagicCastle(boolean can) {
        canBuildMagicCastle = can;
    }

    public void setCanBuildClericCastle(boolean can) {
        canBuildClericCastle = can;
    }

    public List<Building> getAll() {
        List<Building> buildings = new ArrayList<>();

        if (barrackCount > 0) {
            buildings.add(new BarrackBuilding());
        }
        if (clericCastleCount > 0) {
            buildings.add(new ClericCastleBuilding());
        }
        if (magicCastleCount > 0) {
            buildings.add(new MagicCastleBuilding());
        }
        if (hasWall()) {
            buildings.add(new WallBuilding(wallLevel));
        }
        if (hasCastle()) {
            buildings.add(new CastleBuilding());
        }

        return buildings;
    }

    // Getters for counts
    public int getBarrackCount() {
        return barrackCount;
    }

    public int getMagicCastleCount() {
        return magicCastleCount;
    }

    public int getClericCastleCount() {
        return clericCastleCount;
    }

    public WallLevel getWallLevel() {
        return wallLevel;
    }
}
