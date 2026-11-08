from db_models import AIModel, Agent


def test_model_catalog_has_expected_columns_and_constraints() -> None:
    table = AIModel.__table__

    assert set(table.columns) >= {
        table.c.id,
        table.c.provider,
        table.c.model_id,
        table.c.display_name,
        table.c.max_output_tokens,
        table.c.max_temperature,
        table.c.enabled,
        table.c.created_at,
        table.c.updated_at,
    }
    assert any(
        constraint.columns.keys() == ["provider", "model_id"]
        for constraint in table.constraints
        if constraint.__class__.__name__ == "UniqueConstraint"
    )
    checks = {
        str(constraint.sqltext)
        for constraint in table.constraints
        if hasattr(constraint, "sqltext")
    }
    assert "provider IN ('anthropic', 'openai', 'google', 'deepseek')" in checks
    assert "max_output_tokens > 0" in checks
    assert "max_temperature > 0 AND max_temperature <= 2" in checks


def test_agent_provider_constraint_includes_catalog_providers() -> None:
    checks = {
        str(constraint.sqltext)
        for constraint in Agent.__table__.constraints
        if hasattr(constraint, "sqltext")
    }

    assert "provider IN ('anthropic', 'openai', 'google', 'deepseek')" in checks
