defmodule TradingFours.Repo.Migrations.CreateMessages do
  use Ecto.Migration

  def change do
    create table(:messages) do
      add :midi_sequence, {:array, :map}, null: false
      add :author, :string, null: false
      add :room_id, :string, null: false
      add :color, :string, null: false

      timestamps()
    end

    create index(:messages, [:room_id])
  end
end
