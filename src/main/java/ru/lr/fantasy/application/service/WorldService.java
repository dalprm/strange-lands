package ru.lr.fantasy.application.service;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import ru.lr.fantasy.application.port.in.WorldUseCase;
import ru.lr.fantasy.domain.repository.PlayerRepository;
import ru.lr.fantasy.domain.repository.WorldRepository;
import ru.lr.fantasy.domain.model.Land;
import ru.lr.fantasy.domain.model.Player;
import ru.lr.fantasy.domain.model.World;
import ru.lr.fantasy.domain.model.WorldFactory;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

@org.springframework.stereotype.Service
public class WorldService implements WorldUseCase {

    private final WorldRepository worldRepository;
    private final PlayerRepository playerRepository;

    public WorldService(WorldRepository worldRepository, PlayerRepository playerRepository) {
        this.worldRepository = worldRepository;
        this.playerRepository = playerRepository;
    }

    @Override
    public World createWorld(int sizeX, int sizeY) {
        WorldFactory factory = new WorldFactory();
        World world = factory.create(sizeX, sizeY);
        return worldRepository.save(world);
    }

    @Override
    public World createWorld(int sizeX, int sizeY, List<Long> playerIds) {
        if (playerIds == null || playerIds.isEmpty()) {
            return createWorld(sizeX, sizeY);
        }
        List<Long> turnOrder = dedupePreserveOrder(playerIds);
        Player[] players = turnOrder.stream()
                .map(id -> playerRepository.findById(id)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Player not found: " + id)))
                .toArray(Player[]::new);
        WorldFactory factory = new WorldFactory(players);
        World world = factory.create(sizeX, sizeY);
        world.getTurn().setCurrentPlayerId(turnOrder.get(0));
        return worldRepository.save(world);
    }

    @Override
    public void addPlayerToWorld(Long worldId, Long playerId) {
        World world = getWorld(worldId);
        Player player = playerRepository.findById(playerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Player not found: " + playerId));
        boolean alreadyIn = world.getLands().stream()
                .anyMatch(land -> land.hasPlayer() && player.equals(land.getPlayer()));
        if (alreadyIn) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Player already in this world");
        }
        List<Land> free = world.getLands().stream().filter(land -> !land.hasPlayer()).toList();
        if (free.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "No free land in this world");
        }
        Land land = free.get(ThreadLocalRandom.current().nextInt(free.size()));
        land.setPlayer(player);
        world.ensurePlayerWorldResources(playerId);
        var turn = world.getTurn();
        if (turn.getCurrentPlayerId() == null) {
            turn.setCurrentPlayerId(playerId);
        }
        turn.ensureCurrentPlayerAssigned();
        worldRepository.save(world);
    }

    private static List<Long> dedupePreserveOrder(List<Long> ids) {
        List<Long> out = new ArrayList<>();
        Set<Long> seen = new HashSet<>();
        for (Long id : ids) {
            if (id != null && seen.add(id)) {
                out.add(id);
            }
        }
        return out;
    }

    @Override
    public World getWorld(Long id) {
        return worldRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("World not found with id: " + id));
    }

    @Override
    public List<World> getAllWorlds() {
        return worldRepository.findAll();
    }

    @Override
    public List<Land> getPlayerLands(Long worldId, Long playerId) {
        World world = getWorld(worldId);
        Player player = new Player();
        player.setId(playerId);
        return world.getPlayerLands(player);
    }

    @Override
    public World saveWorld(World world) {
        return worldRepository.save(world);
    }

    @Override
    public void deleteWorld(Long id) {
        worldRepository.deleteById(id);
    }
}
