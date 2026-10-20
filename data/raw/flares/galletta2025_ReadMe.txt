J/A+A/698/A180      Short-term stellar activity in dM stars    (Galletta+, 2025)
================================================================================
Exploring short-term stellar activity in M dwarfs: A volume-limited perspective.
    Galletta G., Colombo S., Prisinzano L., Micela G.
    <Astron. Astrophys. 698, A180 (2025)>
    =2025A&A...698A.180G        (SIMBAD/NED BibCode)
================================================================================
ADC_Keywords: Stars, dwarfs ; Stars, M-type ; Photometry ; Optical
Keywords: catalogs - stars: activity - stars: flare

Abstract:
    Flares are a form of stellar activity that occur over short timescales
    but produce highly energetic outbursts. Studying stellar flares is
    crucial because they can significantly alter the circumstellar
    environment by producing intense high-energy radiation. Understanding
    stellar flares is essential for clarifying the environment in which
    planets evolve, as flares can influence planetary atmospheres by
    driving photoevaporation and photochemical processes. M dwarfs are of
    significant interest due to their high flare activity rates and the
    potential presence of exoplanets within their habitable zones, whose
    atmospheres may be influenced by flare-emitted radiation.

    We aimed to define the flaring properties of an unbiased sample of M
    dwarfs with limited volume. Using data from the Transiting Exoplanet
    Survey Satellite (TESS), we characterized the frequency, energy
    distribution, and temporal properties of flares in nearby stars.

    We selected a volume-limited sample of M dwarfs within 10pc from
    Earth from the Gaia DR3 catalog. We analyzed TESS light curves using
    an iterative Gaussian process fitting technique to remove long-term
    stellar activity signals, enabling the identification and
    characterization of impulsive flare events. For each flare, we derived
    the amplitudes, timescales, and total energy emitted.

    We analyzed 173 stars and detected 17229 flares, with 0 to 76
    flares per TESS sector. We examined the frequency and energy
    distribution of stellar flares using three representative stars to
    illustrate the diversity in flare activity. We observed flares with a
    minimum energy of ~10^29^erg and typical durations ranging from 2
    to 8000 seconds. We modeled the cumulative flare energy distribution
    using one-slope and two-slope fits, yielding average slopes of
    -0.79+/-0.64 and -1.23+/-1.32, respectively. We defined
    the Flare Energy Index (GF.01) to characterize the flare frequency and
    revealed two distinct populations. Fainter stars exhibited fewer
    high-energy flares, whereas brighter stars exhibited more frequent
    low-energy flares. We analyzed two highly active stars with the
    largest number of TESS sectors, G 227-22 and G 258-33, were analyzed
    over a long time baseline to explore their flare properties and energy
    distributions.

Description:
    The objective of this work is to define the flaring properties of an
    unbiased, volume-limited sample of M-type stars. Using the Transiting
    Exoplanet Survey Satellite (TESS), we aim to characterize the
    frequency, energy distribution, and temporal properties of flares in
    nearby stars. We selected a volume-limited sample of M-type stars
    within 10 parsecs from the Gaia DR3 catalog. TESS light curves were
    analyzed using an iterative Gaussian process fitting technique to
    remove long-term stellar activity signals, allowing us to identify and
    characterize impulsive flare events. For each flare, we derived
    amplitudes, timescales, and the total energy emitted.We analyzed 173
    stars and detected 17229 flares, with 0 to 76 flares per TESS sector.

    Table shows the name of the stars analyzed, the TESS sectors, the
    number of flares, the L_bol_, the slopes and the energy breaks. The
    value --- indicates the one-segment fit cases that is without energy
    break.

File Summary:
--------------------------------------------------------------------------------
 FileName      Lrecl  Records   Explanations
--------------------------------------------------------------------------------
ReadMe            80        .   This file
stars.dat         46      172   List of targets
table3.dat        71      751   Table of TESS sector activity
--------------------------------------------------------------------------------

See also:
   IV/39 : TESS Input Catalog version 8.2 (TIC v8.2) (Paegert+, 2021)

Byte-by-byte Description of file: stars.dat
--------------------------------------------------------------------------------
   Bytes Format Units   Label     Explanations
--------------------------------------------------------------------------------
   1- 22  A22   ---     Name      Name of the target star
  24- 25  I2    h       RAh       Simbad right ascension (J2000)
  27- 28  I2    min     RAm       Simbad right ascension (J2000)
  30- 34  F5.2  s       RAs       Simbad right ascension (J2000)
      36  A1    ---     DE-       Simbad declination sign (J2000)
  37- 38  I2    deg     DEd       Simbad declination (J2000)
  40- 41  I2    arcmin  DEm       Simbad declination (J2000)
  43- 46  F4.1  arcsec  DEs       Simbad declination (J2000)
--------------------------------------------------------------------------------

Byte-by-byte Description of file: table3.dat
--------------------------------------------------------------------------------
   Bytes Format Units   Label     Explanations
--------------------------------------------------------------------------------
   1- 22  A22   ---     Name      Name of the target star
  24- 26  A3    ---     Sector    TESS sector (e.g., "s39", "s2", etc.)
  28- 30  I3    ---     Flare     Number of flares detected
  32- 40  F9.7  Lsun    Lbol      Bolometric luminosity
  42- 50  F9.7  Lsun  e_Lbol      Bolometric luminosity error
  52- 57  F6.2  ---     Slope     Slope of the flare distribution
  59- 62  F4.2  ---   e_Slope     Slope of the flare distribution error
  64- 71  E8.3  10-7W   EBreak    ?=- Break energy in erg
--------------------------------------------------------------------------------

Acknowledgements:
    Gabriele Galletta, gabriele.galletta(at)inaf.it

References:
    Ricker et al., 2016, in Space Telescopes and Instrumentation 2016:
      Optical, Infrared, and Millimeter Wave, Vol. 9904, SPIE, 767-78
    Prusti et al., 2016A&A...595A...1G, Cat. I/337

================================================================================
(End)                                        Patricia Vannier [CDS]  18-Apr-2025
