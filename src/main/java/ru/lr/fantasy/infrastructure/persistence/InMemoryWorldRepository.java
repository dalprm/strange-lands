package ru.lr.fantasy.infrastructure.persistence;

import ru.lr.fantasy.domain.repository.WorldRepository;
import ru.lr.fantasy.domain.model.World;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@org.springframework.stereotype.Component
public class InMemoryWorldRepository implements WorldRepository {

    private final Map<Long, World> worlds = new ConcurrentHashMap<>();
    private final AtomicLong idGenerator = new AtomicLong(1);

    @Override
    public World save(World world) {
        if (world.getId() == null) {
            world.setId(idGenerator.getAndIncrement());
        }
        worlds.put(world.getId(), world);
        return world;
    }

    @Override
    public Optional<World> findById(Long id) {
        return Optional.ofNullable(worlds.get(id));
    }

    @Override
    public List<World> findAll() {
        return new ArrayList<>(worlds.values());
    }

    @Override
    public void deleteById(Long id) {
        worlds.remove(id);
    }
}
