package ru.lr.fantasy.domain.model.visitors;

import ru.lr.fantasy.domain.model.building.*;

public interface IBuildingVisitor {
    void visit(CastleBuilding building);
    void visit(BarrackBuilding building);
    void visit(WallBuilding building);
    void visit(ClericCastleBuilding building);
    void visit(MagicCastleBuilding building);
}
