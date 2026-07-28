package ru.lr.fantasy.application.service;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import ru.lr.fantasy.application.port.in.LandUseCase;
import ru.lr.fantasy.domain.repository.WorldRepository;
import ru.lr.fantasy.domain.model.action.BuildBuildingAction;
import ru.lr.fantasy.domain.model.action.NewRecruitsAction;
import ru.lr.fantasy.domain.model.action.WarriorsMoveInAction;
import ru.lr.fantasy.domain.model.action.WarriorsMoveOutAction;
import ru.lr.fantasy.domain.model.*;
import ru.lr.fantasy.domain.model.building.Building;

import java.util.List;

@org.springframework.stereotype.Service
public class LandService implements LandUseCase {

    private final WorldRepository worldRepository;

    public LandService(WorldRepository worldRepository) {
        this.worldRepository = worldRepository;
    }

    @Override
    public Land getLand(Long worldId, Long landId) {
        World world = getWorld(worldId);
        Land land = world.getLand(landId);
        if (land == null) {
            throw new RuntimeException("Land not found with id: " + landId);
        }
        return land;
    }

    @Override
    public List<Land> getLands(Long worldId) {
        World world = getWorld(worldId);
        return world.getLands();
    }

    @Override
    public List<Land> getNeighboringLands(Long worldId, Long landId) {
        Land land = getLand(worldId, landId);
        return land.getNeighboring();
    }

    @Override
    public List<Land> listMoveSourceLandsForCurrentTurn(Long worldId, Long toLandId) {
        World world = getWorld(worldId);
        Land toLand = world.getLand(toLandId);
        if (toLand == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Земля не найдена: " + toLandId);
        }
        Turn turn = world.getTurn();
        turn.ensureCurrentPlayerAssigned();
        Long currentId = turn.getCurrentPlayerId();
        if (currentId == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "В мире нет игроков с землями — ход не назначен");
        }
        return world.getLands().stream()
                .filter(Land::hasPlayer)
                .filter(l -> currentId.equals(l.getPlayer().getId()))
                .filter(l -> l.getNeighboring().contains(toLand))
                .filter(l -> l.getWarriors().stream().anyMatch(w -> w.getCount() > 0))
                .sorted()
                .toList();
    }

    @Override
    public void buildBuilding(Long worldId, Long landId, Building building) {
        World world = getWorld(worldId);
        Land land = world.getLand(landId);
        assertLandOwnerIsCurrentPlayer(world, land);
        world.getTurn().acceptAction(new BuildBuildingAction(world, land, building));
        worldRepository.save(world);
    }

    @Override
    public void recruitWarriors(Long worldId, Long landId, WarriorType warriorType, int count, int turnCount) {
        World world = getWorld(worldId);
        Land land = world.getLand(landId);
        assertLandOwnerIsCurrentPlayer(world, land);
        int tc = Math.max(1, turnCount);
        world.getTurn().acceptAction(new NewRecruitsAction(world, land, warriorType, count, tc));
        worldRepository.save(world);
    }

    @Override
    public void moveWarriors(Long worldId, Long fromLandId, Long toLandId, Warrior[] warriors) {
        moveWarriors(worldId, fromLandId, toLandId, null, 1, warriors);
    }

    @Override
    public void moveWarriors(Long worldId, Long fromLandId, Long toLandId, Player player, int turns, Warrior[] warriors) {
        World world = getWorld(worldId);
        Land fromLand = world.getLand(fromLandId);
        Land toLand = world.getLand(toLandId);
        assertLandOwnerIsCurrentPlayer(world, fromLand);
        Player owner = player != null ? player : fromLand.getPlayer();
        int t = Math.max(1, turns);
        Turn turn = world.getTurn();
        turn.acceptAction(new WarriorsMoveOutAction(world, fromLand, warriors));
        turn.acceptAction(new WarriorsMoveInAction(world, toLand, owner, t, warriors));
        worldRepository.save(world);
    }

    private void assertLandOwnerIsCurrentPlayer(World world, Land land) {
        if (!land.hasPlayer()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Клетка без владельца");
        }
        assertPlayerIsCurrent(world, land.getPlayer());
    }

    private void assertPlayerIsCurrent(World world, Player player) {
        if (player == null || player.getId() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Игрок не задан");
        }
        Turn turn = world.getTurn();
        turn.ensureCurrentPlayerAssigned();
        Long current = turn.getCurrentPlayerId();
        if (current == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "В мире нет игроков с землями — ход не назначен");
        }
        if (!current.equals(player.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Сейчас ход игрока id=" + current + ", действие от имени id=" + player.getId());
        }
    }

    private World getWorld(Long worldId) {
        return worldRepository.findById(worldId)
                .orElseThrow(() -> new RuntimeException("World not found with id: " + worldId));
    }
}
