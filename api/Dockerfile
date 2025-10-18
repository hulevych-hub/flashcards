# ------------- Base runtime -------------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app

# Kestrel inside the container will listen on 8080
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

# ------------- Build & publish -------------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# copy solution + projects (adjust if your structure differs)
COPY *.sln ./
COPY *.csproj ./

RUN dotnet restore

# copy the rest
COPY . .

# publish self-contained=false (uses runtime image), no native app host to keep image small
RUN dotnet publish API.csproj -c Release -o /out /p:UseAppHost=false

# ------------- Final image -------------
FROM base AS final
WORKDIR /app

# copy published output
COPY --from=build /out ./

# ensure image folders exist
RUN mkdir -p images/active images/removed

ENTRYPOINT ["dotnet", "API.dll"]
