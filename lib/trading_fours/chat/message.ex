defmodule TradingFours.Chat.Message do
  use Ecto.Schema
  import Ecto.Changeset

  schema "messages" do
    field :content, :string
    field :author, :string
    field :room_id, :string
    field :color, :string

    timestamps()
  end

  def changeset(message, attrs) do
    message
    |> cast(attrs, [:content, :author, :room_id, :color])
    |> validate_required([:content, :author, :room_id, :color])
  end
end
