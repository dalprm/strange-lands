package ru.lr.fantasy.domain.repository;

import ru.lr.fantasy.domain.model.World;

import java.util.List;
import java.util.Optional;

public interface WorldRepository {
    World save(World world);
    Optional<World> findById(Long id);
    List<World> findAll();
    void deleteById(Long id);
}
