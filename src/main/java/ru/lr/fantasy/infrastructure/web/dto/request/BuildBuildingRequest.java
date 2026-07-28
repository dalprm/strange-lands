package ru.lr.fantasy.infrastructure.web.dto.request;

import jakarta.validation.constraints.NotNull;

public class BuildBuildingRequest {
    @NotNull
    private String buildingType;
    
    private Integer wallLevel;

    public String getBuildingType() {
        return buildingType;
    }

    public void setBuildingType(String buildingType) {
        this.buildingType = buildingType;
    }

    public Integer getWallLevel() {
        return wallLevel;
    }

    public void setWallLevel(Integer wallLevel) {
        this.wallLevel = wallLevel;
    }
}
